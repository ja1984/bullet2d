// ─── Bullet 2D PartyKit Server (Authoritative Game Loop) ────────────────────

import type * as Party from "partykit/server"
import type { ServerEnemy, Rect, Vec2, CoverBox, WeaponType } from "../shared/types"
import { MSG, encodeEnemyUpdate, encodePlayerStates, encodeEnemyBullets, encodePlayerBullets, encodeEnemyKilled, encodeEnemyHit, encodeFrame, decodeMsgType, decodeClientPlayerState, decodeEnemyDamage, decodeBullets } from "../shared/binary"
import { ENEMY_CONFIGS } from "../shared/constants"
import { resolvePhysicsShared } from "../shared/physics"
import { generateLevel, generateCoverBoxes, generateWeaponPickups } from "../shared/levelgen"
import { spawnWaveEnemies, getDifficultyMult, createEnemy } from "../shared/waves"

const TICK_MS = 33 // ~30fps
const MAX_PLAYERS = 20

interface PlayerRecord {
  conn: Party.Connection
  index: number
  x: number; y: number; w: number; h: number
  vx: number; vy: number; hp: number; facing: number
  onGround: boolean; crouching: boolean; diving: boolean
  rolling: boolean; bulletTimeActive: boolean
  anim: string; animTimer: number; weapon: string; aimAngle: number
}

interface WeaponPickupRecord {
  x: number; y: number; w: number; h: number
  type: WeaponType; collected: boolean
}

export default class GameServer implements Party.Server {
  // Players
  players: Map<number, PlayerRecord> = new Map()
  playerNicknames: Map<number, string> = new Map()
  nextIndex = 0

  // Game world
  enemies: ServerEnemy[] = []
  platforms: Rect[] = []
  spawnPositions: Vec2[] = []
  coverBoxes: CoverBox[] = []
  weaponPickups: WeaponPickupRecord[] = []

  // Wave state
  wave = 0
  waveState: 'countdown' | 'active' | 'cleared' = 'countdown'
  waveTimer = 3
  gameTime = 0
  reinforcementsSent = false

  // Bullet tracking for enemy spawned bullets
  pendingBullets: { x: number; y: number; vx: number; vy: number; o: string; d: number; p: number }[] = []

  // Game running
  running = false
  paused = false
  lastTick = 0

  // Delta compression: last sent enemy positions (for skipping unchanged)
  lastEnemyX: Map<number, number> = new Map()
  lastEnemyY: Map<number, number> = new Map()

  constructor(readonly room: Party.Room) {}

  // ─── Connection Management ──────────────────────────────────────────────

  onConnect(conn: Party.Connection) {
    const count = [...this.room.getConnections()].length
    if (count > MAX_PLAYERS) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }))
      conn.close()
      return
    }

    const playerIndex = this.nextIndex++
    conn.setState({ playerIndex })

    const player: PlayerRecord = {
      conn, index: playerIndex,
      x: 100 + playerIndex * 50, y: 500, w: 24, h: 44,
      vx: 0, vy: 0, hp: 100, facing: 1,
      onGround: false, crouching: false, diving: false,
      rolling: false, bulletTimeActive: false,
      anim: 'idle', animTimer: 0, weapon: 'pistol', aimAngle: 0,
    }
    this.players.set(playerIndex, player)

    // Send welcome with current player count
    conn.send(JSON.stringify({
      type: 'welcome', playerIndex, roomCode: this.room.id,
      playerCount: this.players.size,
    }))

    // Tell new player about existing players (with nicknames)
    for (const [existingPi] of this.players) {
      if (existingPi !== playerIndex) {
        conn.send(JSON.stringify({ type: 'player_joined', playerIndex: existingPi, nickname: this.playerNicknames.get(existingPi) || '' }))
      }
    }

    // Notify existing players about new player
    this.broadcast({ type: 'player_joined', playerIndex, nickname: '' }, conn.id)

    // If game is already running, send current state to late joiner
    if (this.running) {
      conn.send(JSON.stringify(this.buildGameState()))
    }

    // Start game loop when 2+ players
    if (this.players.size >= 2 && !this.running) {
      this.startGame()
    }
  }

  onClose(conn: Party.Connection) {
    const pi = (conn.state as any)?.playerIndex ?? -1
    this.players.delete(pi)
    this.playerNicknames.delete(pi)
    this.broadcast({ type: 'player_left', playerIndex: pi })

    if (this.players.size < 2) {
      this.running = false
    }
  }

  // ─── Message Handling ───────────────────────────────────────────────────

  onMessage(message: string | ArrayBufferLike, sender: Party.Connection) {
    const pi = (sender.state as any)?.playerIndex ?? -1

    // Binary messages (high-frequency)
    if (typeof message !== 'string') {
      const raw = message as any
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      this.handleBinaryMessage(buf, pi)
      return
    }

    let msg: any
    try { msg = JSON.parse(message) } catch { return }

    switch (msg.type) {
      // JSON fallbacks for player_state and enemy_damage (in case binary detection fails)
      case 'player_state': {
        const p = this.players.get(pi)
        if (!p) break
        p.x = msg.x; p.y = msg.y; p.vx = msg.vx; p.vy = msg.vy
        p.hp = msg.hp; p.facing = msg.f; p.onGround = msg.g === 1
        p.crouching = msg.c === 1; p.diving = msg.d === 1
        p.rolling = msg.r === 1; p.bulletTimeActive = msg.bt === 1
        p.anim = msg.anim; p.animTimer = msg.at
        p.weapon = msg.w; p.aimAngle = msg.aa
        break
      }

      case 'enemy_damage': {
        this.applyEnemyDamage(msg.enemyIdx, msg.damage, msg.headshot, pi)
        break
      }

      case 'set_nickname': {
        const nickname = (msg.nickname || '').trim().slice(0, 16)
        this.playerNicknames.set(pi, nickname)
        this.broadcast({ type: 'nickname_update', playerIndex: pi, nickname })
        break
      }

      case 'cover_destroyed': {
        // Client reports cover box destroyed — broadcast to all
        this.broadcast({ type: 'cover_destroyed', x: msg.x, y: msg.y, coverType: msg.coverType, explosive: msg.explosive })
        // Remove from server state
        for (let i = this.coverBoxes.length - 1; i >= 0; i--) {
          if (Math.abs(this.coverBoxes[i].x - msg.x) < 2 && Math.abs(this.coverBoxes[i].y - msg.y) < 2) {
            this.coverBoxes.splice(i, 1); break
          }
        }
        break
      }

      case 'platform_destroyed': {
        this.broadcast({ type: 'platform_destroyed', x: msg.x, y: msg.y, w: msg.w, h: msg.h })
        for (let i = this.platforms.length - 1; i >= 0; i--) {
          const p = this.platforms[i]
          if (p.destructible && Math.abs(p.x - msg.x) < 2 && Math.abs(p.y - msg.y) < 2) {
            this.platforms.splice(i, 1); break
          }
        }
        break
      }

      case 'weapon_collected': {
        if (msg.index >= 0 && msg.index < this.weaponPickups.length) {
          this.weaponPickups[msg.index].collected = true
          this.broadcast({ type: 'weapon_collected', index: msg.index })
        }
        break
      }

      case 'pause': {
        this.paused = msg.paused
        this.broadcast({ type: 'pause', paused: msg.paused })
        break
      }

      case 'request_restart': {
        this.restartGame()
        break
      }
    }
  }

  // ─── Binary Message Handling ─────────────────────────────────────────────

  handleBinaryMessage(buf: ArrayBuffer, pi: number) {
    const msgType = decodeMsgType(buf)
    switch (msgType) {
      case MSG.C_PLAYER_STATE: {
        const ps = decodeClientPlayerState(buf)
        const p = this.players.get(pi)
        if (!p) break
        p.x = ps.x; p.y = ps.y; p.vx = ps.vx; p.vy = ps.vy
        p.hp = ps.hp; p.facing = ps.facing; p.onGround = ps.onGround
        p.crouching = ps.crouching; p.diving = ps.diving
        p.rolling = ps.rolling; p.bulletTimeActive = ps.bulletTimeActive
        p.anim = ps.anim; p.animTimer = ps.animTimer
        p.weapon = ps.weapon; p.aimAngle = ps.aimAngle
        break
      }
      case MSG.C_ENEMY_DAMAGE: {
        const { enemyIdx, damage, headshot } = decodeEnemyDamage(buf)
        this.applyEnemyDamage(enemyIdx, damage, headshot, pi)
        break
      }
      case MSG.C_PLAYER_BULLETS: {
        // Re-encode as PLAYER_BULLETS and broadcast to everyone except sender
        const bullets = decodeBullets(buf)
        if (bullets.length > 0) {
          const outBuf = new Uint8Array(encodePlayerBullets(bullets))
          for (const [, p] of this.players) {
            if (p.index !== pi) p.conn.send(outBuf)
          }
        }
        break
      }
    }
  }

  applyEnemyDamage(enemyIdx: number, damage: number, headshot: boolean, killerPi = -1) {
    const e = this.enemies[enemyIdx]
    if (!e || e.state === 'dead') return
    const dmg = headshot ? e.maxHp : Math.min(damage, e.hp)
    e.hp -= dmg
    e.hitTimer = 0.3
    if (e.hp <= 0) {
      e.state = 'dead'
      e.deathTimer = 3
      this.broadcastBinary(encodeEnemyKilled(enemyIdx, killerPi))
      if (Math.random() < 0.4) {
        const dropTypes = ['shotgun', 'm16', 'sniper', 'grenades'] as const
        const dropType = dropTypes[Math.floor(Math.random() * dropTypes.length)]
        const amounts: Record<string, number> = { shotgun: 4, m16: 15, sniper: 3, grenades: 2 }
        this.broadcast({ type: 'ammo_drop', x: Math.round(e.x + e.w / 2), y: Math.round(e.y), weaponType: dropType, amount: amounts[dropType] })
      }
    } else {
      this.broadcastBinary(encodeEnemyHit(enemyIdx, e.hp))
    }
  }

  // ─── Game Loop (onAlarm) ────────────────────────────────────────────────

  async onAlarm() {
    if (!this.running || this.paused) {
      // Keep alarm alive even when paused
      if (this.running) this.room.storage.setAlarm(Date.now() + TICK_MS)
      return
    }

    const now = Date.now()
    const dt = Math.min((now - this.lastTick) / 1000, 0.05)
    this.lastTick = now
    this.gameTime += dt

    // Run game tick
    this.updateEnemies(dt)
    this.updateWaveState(dt)

    // Build per-tick binary messages and batch into single frame per client
    const enemyBuf = this.buildEnemyUpdate()
    const bulletBuf = this.pendingBullets.length > 0 ? encodeEnemyBullets(this.pendingBullets) : null
    this.pendingBullets = []

    // Build per-player frames (each gets enemy + bullets + other players)
    const allPlayerData = this.buildAllPlayerData()
    for (const [pi, p] of this.players) {
      const msgs: ArrayBuffer[] = []
      if (enemyBuf) msgs.push(enemyBuf)
      if (bulletBuf) msgs.push(bulletBuf)
      // Player states excluding self
      const others = allPlayerData.filter((d: { pi: number }) => d.pi !== pi)
      if (others.length > 0) msgs.push(encodePlayerStates(others))
      if (msgs.length > 0) {
        const out = msgs.length === 1 ? msgs[0] : encodeFrame(msgs)
        p.conn.send(new Uint8Array(out))
      }
    }

    // Schedule next tick
    this.room.storage.setAlarm(Date.now() + TICK_MS)
  }

  // ─── Enemy AI ───────────────────────────────────────────────────────────

  updateEnemies(dt: number) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (e.hitTimer > 0) e.hitTimer -= dt

      if (e.state === 'dead') {
        e.deathTimer -= dt
        continue
      }

      // Kill if fallen out of map
      if (e.y > 800) {
        e.state = 'dead'
        e.deathTimer = 0.1
        this.broadcastBinary(encodeEnemyKilled(i))
        continue
      }

      const cfg = ENEMY_CONFIGS[e.behavior]

      // Find closest alive player
      let targetX = 0, targetY = 0, targetW = 24, targetH = 44
      let hasTarget = false
      let closestDist = Infinity
      for (const [, p] of this.players) {
        if (p.hp <= 0) continue
        const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y)
        if (d < closestDist) {
          closestDist = d
          targetX = p.x; targetY = p.y; targetW = p.w; targetH = p.h
          hasTarget = true
        }
      }

      const dx = targetX - e.x
      const dy = targetY - e.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (!hasTarget) {
        if (e.state === 'alert') { e.alertTimer -= dt; if (e.alertTimer <= 0) e.state = 'idle' }
      } else if (dist < cfg.sightRange) {
        e.state = 'alert'
        e.alertTimer = 3
        e.facing = dx > 0 ? 1 : -1
      } else if (e.state === 'alert') {
        e.alertTimer -= dt
        if (e.alertTimer <= 0) e.state = 'idle'
      }

      if (e.state === 'idle') {
        e.patrolTimer -= dt
        if (e.patrolTimer <= 0) {
          e.patrolDir *= -1
          e.patrolTimer = 2 + Math.random() * 3
        }
        if (e.behavior === 'drone') {
          e.vx = e.patrolDir * cfg.speed
          e.vy = Math.sin(this.gameTime * 3 + e.x) * 30
        } else {
          e.vx = e.patrolDir * cfg.speed
          e.facing = e.patrolDir
        }
      } else if (e.state === 'alert') {
        if (e.behavior === 'drone') {
          e.vx = (dx > 0 ? 1 : -1) * cfg.speed
          e.vy = ((targetY - 80) - e.y) * 2
        } else if (e.behavior === 'rusher') {
          e.vx = (dx > 0 ? 1 : -1) * cfg.speed
        } else if (e.behavior === 'sniper') {
          e.vx = dist < 300 ? (dx > 0 ? -1 : 1) * cfg.speed : 0
        } else {
          e.vx = (e.hitTimer > 0 && e.hp < e.maxHp * 0.5) ? (dx > 0 ? -1 : 1) * cfg.speed * 1.5 : 0
        }

        // Shooting
        e.shootTimer -= dt
        if (e.shootTimer <= 0 && hasTarget) {
          e.shootTimer = (cfg.shootInterval / getDifficultyMult(this.wave)) * (0.8 + Math.random() * 0.4)
          const angle = Math.atan2(
            (targetY + targetH / 2) - (e.y + e.h / 2),
            (targetX + targetW / 2) - (e.x + e.w / 2)
          )
          for (let p = 0; p < cfg.pellets; p++) {
            const spreadAngle = angle + (Math.random() - 0.5) * cfg.spread * 2
            this.pendingBullets.push({
              x: Math.round(e.x + e.w / 2 + Math.cos(angle) * 16),
              y: Math.round(e.y + e.h / 2 - 4 + Math.sin(angle) * 16),
              vx: Math.round(Math.cos(spreadAngle) * cfg.bulletSpeed),
              vy: Math.round(Math.sin(spreadAngle) * cfg.bulletSpeed),
              o: 'enemy', d: cfg.damage, p: 0,
            })
          }
        }
      }

      // Physics
      if (e.behavior === 'drone') {
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.x = Math.max(20, Math.min(e.x, 2380 - e.w))
        e.y = Math.max(50, Math.min(e.y, 580))
      } else {
        resolvePhysicsShared(e, dt, this.platforms, this.coverBoxes)
      }
    }
  }

  // ─── Wave State Machine ─────────────────────────────────────────────────

  updateWaveState(dt: number) {
    if (this.waveState === 'countdown') {
      this.waveTimer -= dt
      if (this.waveTimer <= 0) {
        this.startWave()
      }
    } else if (this.waveState === 'active') {
      const alive = this.enemies.filter(e => e.state !== 'dead').length

      // Reinforcements on wave 6+
      if (this.wave >= 6 && alive > 0 && alive <= Math.floor(this.enemies.length / 2)) {
        if (!this.reinforcementsSent) {
          this.reinforcementsSent = true
          const behaviors = ['grunt', 'rusher', 'drone'] as const
          const count = 1 + Math.floor(this.wave / 4)
          const newEnemies: ServerEnemy[] = []
          for (let r = 0; r < count; r++) {
            const rx = 200 + Math.random() * 2000
            const behavior = behaviors[Math.floor(Math.random() * behaviors.length)]
            const enemy = createEnemy(rx, behavior === 'drone' ? 50 : -50, behavior, this.wave)
            this.enemies.push(enemy)
            newEnemies.push(enemy)
          }
          this.broadcast({ type: 'reinforcements', enemies: newEnemies })
        }
      }

      if (alive === 0) {
        this.waveState = 'cleared'
        this.waveTimer = 4
        this.broadcast({ type: 'wave_cleared' })
      }
    } else if (this.waveState === 'cleared') {
      this.waveTimer -= dt
      if (this.waveTimer <= 0) {
        this.enemies = []
        this.waveState = 'countdown'
        this.waveTimer = 3
        this.broadcast({ type: 'wave_countdown', wave: this.wave + 1, timer: 3 })
      }
    }
  }

  startWave() {
    this.wave++
    // Wave 1 uses the initial level, wave 2+ generates new
    if (this.wave > 1) {
      const level = generateLevel(this.wave)
      this.platforms = level.platforms
      this.spawnPositions = level.spawnPositions
      this.coverBoxes = generateCoverBoxes(this.platforms)
      this.weaponPickups = generateWeaponPickups(this.platforms).map(p => ({
        x: p.pos.x, y: p.pos.y, w: 20, h: 14, type: p.type, collected: false,
      }))
    }
    this.enemies = spawnWaveEnemies(this.wave, this.spawnPositions, this.players.size)
    this.waveState = 'active'
    this.reinforcementsSent = false

    this.broadcast({
      type: 'wave_start',
      wave: this.wave,
      platforms: this.platforms,
      spawnPositions: this.spawnPositions,
      coverBoxes: this.coverBoxes,
      weaponPickups: this.weaponPickups,
      enemies: this.enemies,
    })
  }

  // ─── Game Lifecycle ─────────────────────────────────────────────────────

  startGame() {
    this.wave = 0
    this.waveState = 'countdown'
    this.waveTimer = 3
    this.gameTime = 0
    this.running = true
    this.paused = false
    this.lastTick = Date.now()

    // Generate initial level
    const level = generateLevel(1)
    this.platforms = level.platforms
    this.spawnPositions = level.spawnPositions
    this.coverBoxes = generateCoverBoxes(this.platforms)
    this.weaponPickups = generateWeaponPickups(this.platforms).map(p => ({
      x: p.pos.x, y: p.pos.y, w: 20, h: 14, type: p.type, collected: false,
    }))

    // Send initial game state to all
    const gs = this.buildGameState()
    for (const [, p] of this.players) {
      p.conn.send(JSON.stringify(gs))
    }

    // Start tick loop
    this.room.storage.setAlarm(Date.now() + TICK_MS)
  }

  restartGame() {
    this.enemies = []
    this.wave = 0
    this.waveState = 'countdown'
    this.waveTimer = 3
    this.gameTime = 0
    this.paused = false
    this.reinforcementsSent = false

    // Reset all player HP
    for (const [, p] of this.players) {
      p.hp = 100
      p.x = 100 + p.index * 50
      p.y = 500
    }

    // Generate fresh level
    const level = generateLevel(1)
    this.platforms = level.platforms
    this.spawnPositions = level.spawnPositions
    this.coverBoxes = generateCoverBoxes(this.platforms)
    this.weaponPickups = generateWeaponPickups(this.platforms).map(p => ({
      x: p.pos.x, y: p.pos.y, w: 20, h: 14, type: p.type, collected: false,
    }))

    this.broadcast({
      type: 'game_restart',
      platforms: this.platforms,
      spawnPositions: this.spawnPositions,
      coverBoxes: this.coverBoxes,
      weaponPickups: this.weaponPickups,
      enemies: [],
    })

    if (!this.running) {
      this.running = true
      this.lastTick = Date.now()
      this.room.storage.setAlarm(Date.now() + TICK_MS)
    }
  }

  // ─── Broadcasting ───────────────────────────────────────────────────────

  buildGameState() {
    return {
      type: 'game_state',
      wave: this.wave,
      waveState: this.waveState,
      platforms: this.platforms,
      spawnPositions: this.spawnPositions,
      coverBoxes: this.coverBoxes,
      weaponPickups: this.weaponPickups,
      enemies: this.enemies.filter(e => e.state !== 'dead'),
    }
  }

  buildEnemyUpdate(): ArrayBuffer | null {
    // Delta compression: only send enemies whose position changed by >2px
    const data: { i: number; x: number; y: number; vx: number; vy: number; facing: number; hp: number; alert: boolean }[] = []
    for (let i = 0; i < this.enemies.length; i++) {
      const en = this.enemies[i]
      if (en.state === 'dead') continue
      const rx = Math.round(en.x), ry = Math.round(en.y)
      const lastX = this.lastEnemyX.get(i) ?? -9999
      const lastY = this.lastEnemyY.get(i) ?? -9999
      if (Math.abs(rx - lastX) > 2 || Math.abs(ry - lastY) > 2) {
        data.push({ i, x: rx, y: ry, vx: Math.round(en.vx), vy: Math.round(en.vy), facing: en.facing, hp: en.hp, alert: en.state === 'alert' })
        this.lastEnemyX.set(i, rx)
        this.lastEnemyY.set(i, ry)
      }
    }
    return data.length > 0 ? encodeEnemyUpdate(data) : null
  }

  buildAllPlayerData(): { pi: number; x: number; y: number; vx: number; vy: number; hp: number; facing: number; ground: boolean; crouch: boolean; dive: boolean; roll: boolean; bt: boolean; anim: string; animTimer: number; weapon: string; aimAngle: number }[] {
    const all: { pi: number; x: number; y: number; vx: number; vy: number; hp: number; facing: number; ground: boolean; crouch: boolean; dive: boolean; roll: boolean; bt: boolean; anim: string; animTimer: number; weapon: string; aimAngle: number }[] = []
    for (const [pi, p] of this.players) {
      all.push({ pi, x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, facing: p.facing, ground: p.onGround, crouch: p.crouching, dive: p.diving, roll: p.rolling, bt: p.bulletTimeActive, anim: p.anim, animTimer: p.animTimer, weapon: p.weapon, aimAngle: p.aimAngle })
    }
    return all
  }

  broadcast(msg: any, excludeId?: string) {
    const data = JSON.stringify(msg)
    for (const conn of this.room.getConnections()) {
      if (excludeId && conn.id === excludeId) continue
      conn.send(data)
    }
  }

  broadcastBinary(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf)
    for (const conn of this.room.getConnections()) {
      conn.send(bytes)
    }
  }
}
