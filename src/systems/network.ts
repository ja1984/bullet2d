// ─── Network System (Server Authoritative) ───────────────────────────────────
// Server runs enemy AI, waves, and game state.
// Clients own their own player movement and send state + damage events.

import PartySocket from 'partysocket'
import { state, createPlayerState, respawnPlayer } from '../state'
import { setGeneratedLevel, ENEMY_CONFIGS, platforms } from '../constants'
import { SFX } from '../audio'
import { restart } from '../main'
import { spawnParticles } from './particles'
import { enemyTypes } from '../sprites/enemySprites'
import { COMBO_WINDOW } from '../constants'
import { MSG, decodeMsgType, decodeEnemyUpdate, decodePlayerStates, decodeEnemyBullets, decodeEnemyKilled, decodeEnemyHit, decodeFrame, encodeClientPlayerState, encodeEnemyDamage as encodeEnemyDamageBin, encodeClientPlayerBullets, decodeBullets } from '../../shared/binary'

let socket: PartySocket | null = null
let connected = false
let roomCode = ''
let localPlayerIndex = 0
let lastSyncTime = 0
let inRoom = false
let serverAuthoritative = false
let localNickname = localStorage.getItem('bulletTime2d_nickname') || ''
let intentionalDisconnect = false
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const MAX_RECONNECT_ATTEMPTS = 3

// Remote player nicknames (keyed by playerIndex)
const nicknames: Map<number, string> = new Map()

// Remote player interpolation targets (per slot)
const remoteTargets: Map<number, { x: number; y: number; vx: number; vy: number }> = new Map()

// Enemy interpolation targets
const enemyTargets: Map<number, { x: number; y: number; vx: number; vy: number }> = new Map()

// Callbacks
let onStatusChange: ((status: string) => void) | null = null
let onRoomListUpdate: ((rooms: string[]) => void) | null = null

const PARTYKIT_HOST = location.hostname === 'localhost'
  ? 'localhost:1999'
  : 'bullet2d.ja1984.partykit.dev'

// ─── Connection ─────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function hostGame() {
  roomCode = generateRoomCode()
  connectToRoom(roomCode)
}

export function joinGame(code: string) {
  roomCode = code.toUpperCase()
  connectToRoom(roomCode)
}

// ─── Binary Message Handler ─────────────────────────────────────────────────

function handleBinaryMessage(buf: ArrayBuffer) {
  const msgType = decodeMsgType(buf)
  switch (msgType) {
    case MSG.ENEMY_UPDATE: {
      for (const ed of decodeEnemyUpdate(buf)) {
        const e = state.enemies[ed.i]
        if (!e || e.state === 'dead') continue
        enemyTargets.set(ed.i, { x: ed.x, y: ed.y, vx: ed.vx, vy: ed.vy })
        if (Math.abs(ed.x - e.x) > 100 || Math.abs(ed.y - e.y) > 100) {
          e.x = ed.x; e.y = ed.y
        }
        e.vx = ed.vx; e.vy = ed.vy
        e.facing = ed.facing; e.hp = ed.hp
        e.state = ed.alert ? 'alert' : 'idle'
        e.currentAnim = ed.alert ? 'walk' : 'idle'
      }
      break
    }
    case MSG.PLAYER_STATES: {
      for (const ps of decodePlayerStates(buf)) {
        applyRemotePlayerState(ps)
      }
      break
    }
    case MSG.ENEMY_BULLETS: {
      for (const b of decodeEnemyBullets(buf)) {
        state.bullets.push({
          x: b.x, y: b.y, vx: b.vx, vy: b.vy,
          owner: 'enemy', life: 2, trail: [], damage: b.d,
        })
      }
      break
    }
    case MSG.PLAYER_BULLETS: {
      for (const b of decodeBullets(buf)) {
        state.bullets.push({
          x: b.x, y: b.y, vx: b.vx, vy: b.vy,
          owner: 'player', life: 2, trail: [], damage: b.d,
        })
      }
      break
    }
    case MSG.ENEMY_KILLED: {
      const { index: idx, killerPi } = decodeEnemyKilled(buf)
      const e = state.enemies[idx]
      if (e && e.state !== 'dead') {
        e.hp = 0; e.state = 'dead'
        const deathFrames = enemyTypes[e.type]?.spriteConfig.death.frames ?? 10
        const deathFps = enemyTypes[e.type]?.spriteConfig.death.fps ?? 10
        e.deathTimer = (deathFrames / deathFps) + 2
        e.vx = 0; e.vy = 0
        state.killCount++
        state.hitPauseTimer = 0.05
        state.screenShake = 10
        SFX.enemyDeath(e.type)
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 20, '#f44', 250)
        state.bloodDecals.push({ x: e.x + e.w / 2, y: e.y + e.h, size: 15 + Math.random() * 15, alpha: 1 })

        // Combo
        state.comboCount++
        state.comboTimer = COMBO_WINDOW
        if (state.comboCount >= 2) {
          state.floatingTexts.push({
            x: e.x + e.w / 2, y: e.y - 25,
            text: `${state.comboCount}x COMBO!`, color: '#ffaa22',
            life: 1.0, maxLife: 1.0,
          })
        }

        // Kill feed with attribution
        const killerName = killerPi >= 0 ? getNickname(killerPi) : ''
        const enemyName = e.behavior === 'boss' ? 'BOSS' : e.behavior.toUpperCase()
        if (killerName) {
          state.killFeed.push({ text: `${killerName} killed ${enemyName}`, color: '#ffcc44', life: 2.5, maxLife: 2.5 })
        }

        // Multi-kill feed
        state.multiKillCount++
        state.multiKillTimer = 1.5
        if (state.multiKillCount === 2) state.killFeed.push({ text: 'DOUBLE KILL!', color: '#ff8844', life: 2.5, maxLife: 2.5 })
        else if (state.multiKillCount === 3) state.killFeed.push({ text: 'TRIPLE KILL!', color: '#ffaa22', life: 2.5, maxLife: 2.5 })
        else if (state.multiKillCount === 4) state.killFeed.push({ text: 'QUAD KILL!', color: '#ffcc00', life: 3.0, maxLife: 3.0 })
        else if (state.multiKillCount >= 5) state.killFeed.push({ text: 'RAMPAGE!', color: '#ff00ff', life: 3.0, maxLife: 3.0 })
        if (state.killFeed.length > 5) state.killFeed.shift()

        // Kill cam on last enemy
        const aliveCount = state.enemies.filter(en => en !== e && en.state !== 'dead').length
        if (aliveCount === 0 && state.waveState === 'active') {
          state.killCamActive = true
          state.killCamTimer = 1.5
        }
      }
      break
    }
    case MSG.ENEMY_HIT: {
      const { index, hp } = decodeEnemyHit(buf)
      const e = state.enemies[index]
      if (e) e.hp = hp
      break
    }
    case MSG.FRAME: {
      // Batched frame — unpack and handle each sub-message
      for (const sub of decodeFrame(buf)) {
        handleBinaryMessage(sub)
      }
      break
    }
  }
}

function connectToRoom(room: string) {
  intentionalDisconnect = false
  onStatusChange?.(`Connecting to room ${room}...`)

  socket = new PartySocket({ host: PARTYKIT_HOST, room })
  socket.binaryType = 'arraybuffer'

  socket.addEventListener('open', () => {
    connected = true
    reconnectAttempts = 0
    intentionalDisconnect = false
  })

  socket.addEventListener('close', () => {
    connected = false
    inRoom = false
    const wasRoom = roomCode

    if (!intentionalDisconnect && wasRoom && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // Auto-reconnect
      reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 8000)
      onStatusChange?.(`Connection lost. Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        onStatusChange?.(`Reconnecting to ${wasRoom}...`)
        connectToRoom(wasRoom)
      }, delay)
    } else {
      // Full disconnect
      roomCode = ''
      serverAuthoritative = false
      state.coopEnabled = false
      state.players.length = 1
      remoteTargets.clear()
      enemyTargets.clear()
      nicknames.clear()
      reconnectAttempts = 0
      onStatusChange?.('Disconnected')
    }
  })

  socket.addEventListener('error', () => { onStatusChange?.('Connection error') })

  socket.addEventListener('message', (event: MessageEvent) => {
    // Binary messages (high-frequency)
    if (event.data instanceof ArrayBuffer) {
      handleBinaryMessage(event.data)
      return
    }
    // Also handle Blob (some WebSocket impls)
    if (event.data instanceof Blob) {
      event.data.arrayBuffer().then(handleBinaryMessage)
      return
    }

    // All messages use array format: [type, data]
    let raw: any
    try { raw = JSON.parse(event.data) } catch { return }

    const msgType = Array.isArray(raw) ? raw[0] : raw.type
    const d = Array.isArray(raw) ? raw[1] : raw

    switch (msgType) {
      // ─── Connection ───────────────────────────────────────────────
      case 'wl': // welcome: [playerIndex, roomCode, playerCount]
        localPlayerIndex = d[0]
        roomCode = d[1]
        inRoom = true
        state.players[0].playerIndex = localPlayerIndex
        nicknames.set(localPlayerIndex, localNickname)
        onStatusChange?.(`Room: ${roomCode} — You are P${localPlayerIndex + 1}`)
        if (socket && localNickname) {
          socket.send(JSON.stringify(["nn", localNickname]))
        }
        break

      case 'pj': { // player_joined: [playerIndex, nickname]
        const name = d[1] || `P${d[0] + 1}`
        nicknames.set(d[0], name)
        onStatusChange?.(`${name} joined! Room: ${roomCode}`)
        state.coopEnabled = true
        ensureRemotePlayer(d[0])
        break
      }

      case 'nu': // nickname_update: [playerIndex, nickname]
        nicknames.set(d[0], d[1])
        break

      case 'pl': { // player_left: playerIndex
        const leftName = nicknames.get(d) || `P${(d ?? 0) + 1}`
        nicknames.delete(d ?? -1)
        onStatusChange?.(`${leftName} left`)
        if (d != null) {
          const slot = remoteSlot(d)
          if (slot > 0 && slot < state.players.length) {
            state.players.splice(slot, 1)
            remoteTargets.delete(slot)
          }
        }
        state.coopEnabled = state.players.length > 1
        if (!state.coopEnabled) serverAuthoritative = false
        break
      }

      case 'er': // error: message
        onStatusChange?.(d)
        break

      // ─── Game State (from server) ─────────────────────────────────
      case 'gs': // game_state: { wave, platforms, ... }
        applyLevelData(d)
        serverAuthoritative = true
        startMultiplayerGame()
        break

      case 'ws': // wave_start: { wave, platforms, enemies, ... }
        applyLevelData(d)
        if (state.player.hp <= 0) respawnPlayer()
        state.waveState = 'active'
        state.invincibleTimer = 1.0
        break

      case 'wv': // wave events: "c" = cleared, [wave, timer] = countdown
        if (d === 'c') {
          state.waveState = 'cleared'
          SFX.waveCleared()
          state.waveTimer = 4
          state.player.hp = Math.min(100, state.player.hp + 15)
          for (const wp of state.weaponPickups) wp.collected = false
        } else {
          state.waveState = 'countdown'
          state.waveTimer = d[1]
          state.enemies.length = 0
          state.bloodDecals.length = 0
        }
        break

      // ─── Reinforcements (new enemies mid-wave) ─────────────────────
      case 'rf': { // reinforcements: [enemies...]
        const diff = 1 + (state.wave - 1) * 0.1
        for (const e of d) {
          const cfg = ENEMY_CONFIGS[e.behavior as keyof typeof ENEMY_CONFIGS]
          const hp = e.hp ?? Math.round(cfg.hp * diff)
          state.enemies.push({
            x: e.x, y: e.y,
            w: e.w ?? (e.behavior === 'boss' ? 36 : e.behavior === 'drone' ? 16 : 24),
            h: e.h ?? (e.behavior === 'boss' ? 56 : e.behavior === 'drone' ? 16 : 44),
            hp, maxHp: e.maxHp ?? hp,
            vx: 0, vy: 0, onGround: false, facing: -1,
            shootTimer: Math.random() * cfg.shootInterval,
            alertTimer: 0, state: 'idle' as any, deathTimer: 0,
            patrolDir: Math.random() > 0.5 ? 1 : -1,
            patrolTimer: Math.random() * 3 + 1,
            type: e.type ?? (e.behavior === 'grunt' ? 'thug' : 'grunt'),
            behavior: e.behavior,
            animTimer: 0, currentAnim: 'idle' as any, hitTimer: 0, showHpTimer: 0,
          })
        }
        state.killFeed.push({ text: 'REINFORCEMENTS!', color: '#ff4466', life: 2.5, maxLife: 2.5 })
        break
      }

      // ─── Ammo Drop (server-decided) ───────────────────────────────
      case 'ad': // ammo_drop: [x, y, weaponType, amount]
        state.ammoPickups.push({
          x: d[0], y: d[1],
          vy: -120, onGround: false,
          life: 15, bobTimer: 0,
          weaponType: d[2],
          amount: d[3],
        })
        break

      // ─── World State Changes ──────────────────────────────────────
      case 'wc': { // weapon_collected: index
        const wp = state.weaponPickups[d]
        if (wp) wp.collected = true
        break
      }

      case 'cd': { // cover_destroyed: [x, y, coverType, explosive]
        for (let i = state.coverBoxes.length - 1; i >= 0; i--) {
          const c = state.coverBoxes[i]
          if (Math.abs(c.x - d[0]) < 2 && Math.abs(c.y - d[1]) < 2) {
            state.coverBoxes.splice(i, 1)
            break
          }
        }
        break
      }

      case 'pd': { // platform_destroyed: [x, y, w, h]
        for (let i = platforms.length - 1; i >= 0; i--) {
          const p = platforms[i]
          if (p.destructible && Math.abs(p.x - d[0]) < 2 && Math.abs(p.y - d[1]) < 2) {
            platforms.splice(i, 1)
            break
          }
        }
        break
      }

      // ─── Game Control ─────────────────────────────────────────────
      case 'pa': // pause: 1/0
        state.gameState = d === 1 ? 'paused' : 'playing'
        break

      case 'go': // game_over
        if (!state.gameOver) {
          state.gameOver = true
          state.deathSlowMo = true
          state.deathSlowMoTimer = 2.0
        }
        break

      case 'gr': // game_restart: { platforms, ... }
        restart()
        SFX.startAmbient()
        applyLevelData(d)
        for (let i = 1; i < state.players.length; i++) {
          const p = state.players[i]
          p.hp = 100; p.x = state.player.x + 50 * i; p.y = state.player.y
        }
        state.coopEnabled = true
        break
    }
  })
}

// ─── Apply Level Data (shared between game_state, wave_start, game_restart) ─

function applyLevelData(msg: any) {
  if (msg.platforms) setGeneratedLevel(msg.platforms, msg.spawnPositions || [])

  if (msg.coverBoxes) {
    state.coverBoxes.length = 0
    for (const c of msg.coverBoxes) {
      state.coverBoxes.push({ ...c, vy: 0, falling: false })
    }
  }

  if (msg.weaponPickups) {
    state.weaponPickups.length = 0
    for (const w of msg.weaponPickups) {
      state.weaponPickups.push({ ...w, bobTimer: Math.random() * Math.PI * 2, collected: w.collected || false })
    }
  }

  if (msg.enemies) {
    state.enemies.length = 0
    const wave = msg.wave || 1
    const diff = 1 + (wave - 1) * 0.1
    for (const e of msg.enemies) {
      const cfg = ENEMY_CONFIGS[e.behavior as keyof typeof ENEMY_CONFIGS]
      const hp = e.hp ?? Math.round(cfg.hp * diff)
      const maxHp = e.maxHp ?? hp
      state.enemies.push({
        x: e.x, y: e.y,
        w: e.w ?? (e.behavior === 'boss' ? 36 : e.behavior === 'drone' ? 16 : 24),
        h: e.h ?? (e.behavior === 'boss' ? 56 : e.behavior === 'drone' ? 16 : 44),
        hp, maxHp,
        vx: e.vx ?? 0, vy: e.vy ?? 0, onGround: e.onGround ?? false, facing: e.facing ?? -1,
        shootTimer: e.shootTimer ?? Math.random() * cfg.shootInterval,
        alertTimer: e.alertTimer ?? 0,
        state: e.state ?? 'idle',
        deathTimer: e.deathTimer ?? 0,
        patrolDir: e.patrolDir ?? (Math.random() > 0.5 ? 1 : -1),
        patrolTimer: e.patrolTimer ?? (Math.random() * 3 + 1),
        type: e.type ?? (e.behavior === 'grunt' ? 'thug' : 'grunt'),
        behavior: e.behavior,
        animTimer: 0, currentAnim: 'idle' as any, hitTimer: e.hitTimer ?? 0, showHpTimer: 0,
      })
    }
  }

  if (msg.wave != null) state.wave = msg.wave
  if (msg.waveState) state.waveState = msg.waveState
}

// ─── Remote Player Handling ─────────────────────────────────────────────────

function remoteSlot(remoteIndex: number): number {
  return remoteIndex < localPlayerIndex ? remoteIndex + 1 : remoteIndex
}

function ensureRemotePlayer(remoteIndex: number) {
  const slot = remoteSlot(remoteIndex)
  while (state.players.length <= slot) {
    state.players.push(createPlayerState(state.players.length, state.player.x + 50 * state.players.length, state.player.y))
  }
  // Ensure the player's index matches the server player index (not the array slot)
  state.players[slot].playerIndex = remoteIndex
}

function applyRemotePlayerState(msg: any) {
  const slot = remoteSlot(msg.pi)
  ensureRemotePlayer(msg.pi)
  state.coopEnabled = true

  const p = state.players[slot]
  remoteTargets.set(slot, { x: msg.x, y: msg.y, vx: msg.vx, vy: msg.vy })
  if (Math.abs(msg.x - p.x) > 150 || Math.abs(msg.y - p.y) > 150) {
    p.x = msg.x; p.y = msg.y
  }
  p.hp = msg.hp; p.facing = msg.f
  p.onGround = msg.g === 1; p.crouching = msg.c === 1
  p.diving = msg.d === 1; p.rolling = msg.r === 1
  p.bulletTimeActive = msg.bt === 1
  if (msg.anim) p.currentAnim = msg.anim
  if (msg.at != null) p.animTimer = msg.at
  if (msg.w) p.currentWeapon = msg.w
  if (msg.aa != null) p.aimAngle = msg.aa
}

function startMultiplayerGame() {
  if (state.gameState !== 'playing') {
    state.gameState = 'playing'
    SFX.startAmbient()
  }
}

// ─── Interpolation (called every frame) ─────────────────────────────────────

export function updateRemotePlayer(dt: number) {
  for (const [slot, target] of remoteTargets) {
    const p = state.players[slot]
    if (!p) continue
    p.x += target.vx * dt; p.y += target.vy * dt
    p.x += (target.x - p.x) * 8 * dt; p.y += (target.y - p.y) * 8 * dt
    p.vx = target.vx; p.vy = target.vy
  }

  // Interpolate enemies from server updates
  if (serverAuthoritative) {
    for (const [i, target] of enemyTargets) {
      const e = state.enemies[i]
      if (!e || e.state === 'dead') { enemyTargets.delete(i); continue }
      e.x += target.vx * dt; e.y += target.vy * dt
      e.x += (target.x - e.x) * 10 * dt; e.y += (target.y - e.y) * 10 * dt
    }
  }
}

// ─── Send to Server ─────────────────────────────────────────────────────────

export function sendPlayerState() {
  if (!socket || !connected || !inRoom || !state.coopEnabled) return
  const now = performance.now()
  if (now - lastSyncTime < 33) return
  lastSyncTime = now

  const p = state.player
  const aimWorldX = state.mouse.x + state.camera.x
  const aimWorldY = state.mouse.y + state.camera.y
  const aimAngle = Math.atan2(aimWorldY - (p.y + p.h / 2), aimWorldX - (p.x + p.w / 2))
  // Array format: ["ps", [x, y, vx, vy, hp, f, g, c, d, r, bt, anim, at, w, aa]]
  socket.send(JSON.stringify(["ps", [
    Math.round(p.x), Math.round(p.y),
    Math.round(p.vx), Math.round(p.vy),
    Math.round(p.hp), p.facing,
    p.onGround ? 1 : 0, p.crouching ? 1 : 0,
    p.diving ? 1 : 0, p.rolling ? 1 : 0,
    p.bulletTimeActive ? 1 : 0,
    state.currentAnim, Math.round(state.animTimer * 100) / 100,
    state.currentWeapon, Math.round(aimAngle * 100) / 100,
  ]]))

  // Flush any queued player bullets
  flushPlayerBullets()
}

// ─── Player Bullet Sync ─────────────────────────────────────────────────────

const pendingPlayerBullets: { x: number; y: number; vx: number; vy: number; d: number }[] = []

export function queuePlayerBullet(x: number, y: number, vx: number, vy: number, damage: number) {
  if (!inRoom || !state.coopEnabled) return
  pendingPlayerBullets.push({ x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy), d: damage })
}

function flushPlayerBullets() {
  if (!socket || !connected || pendingPlayerBullets.length === 0) return
  socket.send(JSON.stringify(["pb", pendingPlayerBullets.map(b => [b.x, b.y, b.vx, b.vy, b.d])]))
  pendingPlayerBullets.length = 0
}

export function sendEnemyDamage(enemyIdx: number, damage: number, headshot: boolean) {
  if (!socket || !connected || !serverAuthoritative) return
  socket.send(JSON.stringify(["ed", [enemyIdx, damage, headshot ? 1 : 0]]))
}

export function sendCoverDestroyed(x: number, y: number, coverType: string, explosive: boolean) {
  if (!socket || !connected || !serverAuthoritative) return
  socket.send(JSON.stringify(["cd", [Math.round(x), Math.round(y), coverType, explosive ? 1 : 0]]))
}

export function sendPlatformDestroyed(x: number, y: number, w: number, h: number) {
  if (!socket || !connected || !serverAuthoritative) return
  socket.send(JSON.stringify(["pd", [x, y, w, h]]))
}

export function sendWeaponCollected(index: number) {
  if (!socket || !connected || !serverAuthoritative) return
  socket.send(JSON.stringify(["wc", index]))
}

export function sendPause(paused: boolean) {
  if (!socket || !connected || !inRoom) return
  socket.send(JSON.stringify(["pa", paused ? 1 : 0]))
}

export function sendRestart() {
  if (!socket || !connected) return
  socket.send(JSON.stringify(["rr"]))
}

export function disconnect() {
  intentionalDisconnect = true
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  reconnectAttempts = 0
  socket?.close()
  socket = null
  connected = false
  inRoom = false
  roomCode = ''
  serverAuthoritative = false
  state.coopEnabled = false
  state.players.length = 1
  remoteTargets.clear()
  enemyTargets.clear()
  nicknames.clear()
}

// ─── Getters ────────────────────────────────────────────────────────────────

export function getRoomCode(): string { return roomCode }
export function isConnected(): boolean { return connected }
export function isOnline(): boolean { return inRoom }
export function isServerAuthoritative(): boolean { return serverAuthoritative }
export function isHost(): boolean { return localPlayerIndex === 0 }
export function getRole() { return inRoom ? (localPlayerIndex === 0 ? 'host' : 'guest') : 'none' }
export function getLocalPlayerIndex() { return localPlayerIndex }

export function setOnRoomListUpdate(cb: (rooms: string[]) => void) { onRoomListUpdate = cb }
export function setOnStatusChange(cb: (status: string) => void) { onStatusChange = cb }
export function getNickname(playerIndex: number): string { return nicknames.get(playerIndex) || `P${playerIndex + 1}` }
export function getLocalNickname(): string { return localNickname }
export function setLocalNickname(name: string) {
  localNickname = name.trim().slice(0, 16)
  localStorage.setItem('bulletTime2d_nickname', localNickname)
  nicknames.set(localPlayerIndex, localNickname)
  if (socket && connected && inRoom) {
    socket.send(JSON.stringify(["nn", localNickname]))
  }
}

// ─── Legacy/compat exports (kept for code that still references them) ───────
export function syncGameEvents() {} // No-op: server handles all sync now
export function queueBulletSync(_b: any) {} // No-op: server sends enemy bullets
export function sendWaveLevel(_wave: number) {} // No-op: server sends waves
export type GuestInputPacket = any
export function sendGuestInput(_input: any) {}
export function sendStateSync() { sendPlayerState() }
