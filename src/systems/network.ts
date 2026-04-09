// ─── Network System (Peer Authority) ──────────────────────────────────────────
// Each client is authoritative over their own player.
// They send their player state and receive the other player's state.

import PartySocket from 'partysocket'
import { state, createPlayerState, respawnPlayer } from '../state'
import { platforms, spawnPositions, setGeneratedLevel, ENEMY_CONFIGS } from '../constants'
import { SFX } from '../audio'
import { populateLevel } from './levelgen'
import { restart } from '../main'

let socket: PartySocket | null = null
let connected = false
let roomCode = ''
let localPlayerIndex = 0 // 0 = first to join, 1/2/3 = others
let lastSyncTime = 0
let inRoom = false

let lastEnemySyncTime = 0
const pendingBullets: { x: number; y: number; vx: number; vy: number; owner: string; damage: number; penetrate?: boolean }[] = []

// State sync — track previous frame to detect changes
let prevAlive: boolean[] = []
let prevWeaponCollected: boolean[] = []
let prevHealthCount = 0
let prevAmmoCount = 0
let prevCoverCount = 0
let prevPlatformCount = 0

// Remote player interpolation targets (per player index)
const remoteTargets: Map<number, { x: number; y: number; vx: number; vy: number }> = new Map()

// Enemy interpolation targets (guest only)
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

function connectToRoom(room: string) {
  onStatusChange?.(`Connecting to room ${room}...`)

  socket = new PartySocket({
    host: PARTYKIT_HOST,
    room: room,
  })

  socket.addEventListener('open', () => {
    connected = true
  })

  socket.addEventListener('close', () => {
    connected = false
    inRoom = false
    roomCode = ''
    state.coopEnabled = false
    state.players.length = 1
    onStatusChange?.('Disconnected')
  })

  socket.addEventListener('error', () => {
    onStatusChange?.('Connection error')
  })

  socket.addEventListener('message', (event: MessageEvent) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }

    switch (msg.type) {
      case 'welcome':
        localPlayerIndex = msg.playerIndex
        roomCode = msg.roomCode
        inRoom = true
        onStatusChange?.(`Room: ${roomCode} — You are P${localPlayerIndex + 1}`)
        break

      case 'player_joined': {
        onStatusChange?.(`P${msg.playerIndex + 1} joined! Room: ${roomCode}`)
        state.coopEnabled = true
        ensureRemotePlayer(msg.playerIndex)
        // Host sends level data to new player, then start
        if (isHost()) {
          sendGameStart(msg.playerIndex)
          startMultiplayerGame()
        }
        break
      }

      case 'game_start':
        applyGameStart(msg)
        break

      case 'wave_level':
        applyWaveLevel(msg)
        break

      case 'player_left': {
        onStatusChange?.(`P${(msg.playerIndex ?? 0) + 1} left`)
        if (msg.playerIndex != null) {
          const slot = remoteSlot(msg.playerIndex)
          if (slot > 0 && slot < state.players.length) {
            state.players.splice(slot, 1)
            remoteTargets.delete(slot)
          }
        }
        state.coopEnabled = state.players.length > 1
        break
      }

      case 'error':
        onStatusChange?.(msg.message)
        break

      case 'player_state':
        applyRemotePlayerState(msg)
        break

      case 'enemy_kill':
        for (const idx of msg.indices) {
          const e = state.enemies[idx]
          if (e && e.state !== 'dead') {
            e.hp = 0
            e.state = 'dead'
            e.deathTimer = 3
          }
        }
        break

      case 'enemy_sync':
        for (const ed of msg.enemies) {
          const e = state.enemies[ed.i]
          if (!e || e.state === 'dead') continue
          // Store interpolation target
          enemyTargets.set(ed.i, { x: ed.x, y: ed.y, vx: ed.vx, vy: ed.vy })
          // Snap if too far off
          if (Math.abs(ed.x - e.x) > 100 || Math.abs(ed.y - e.y) > 100) {
            e.x = ed.x; e.y = ed.y
          }
          e.vx = ed.vx; e.vy = ed.vy
          e.facing = ed.f
          e.hp = ed.hp
          e.state = ed.s
          e.currentAnim = ed.s === 'alert' ? 'walk' : 'idle'
        }
        break

      case 'weapon_collected':
        for (const idx of msg.indices) {
          const wp = state.weaponPickups[idx]
          if (wp) wp.collected = true
        }
        break

      case 'health_sync': {
        // Remove any health pickups that aren't in the sender's remaining set
        const hSet = new Set(msg.pickups.map((p: any) => `${p.x},${p.y}`))
        for (let i = state.healthPickups.length - 1; i >= 0; i--) {
          const key = `${Math.round(state.healthPickups[i].x)},${Math.round(state.healthPickups[i].y)}`
          if (!hSet.has(key)) state.healthPickups.splice(i, 1)
        }
        prevHealthCount = state.healthPickups.length
        break
      }

      case 'ammo_sync': {
        const aSet = new Set(msg.pickups.map((p: any) => `${p.x},${p.y},${p.wt}`))
        for (let i = state.ammoPickups.length - 1; i >= 0; i--) {
          const a = state.ammoPickups[i]
          const key = `${Math.round(a.x)},${Math.round(a.y)},${a.weaponType}`
          if (!aSet.has(key)) state.ammoPickups.splice(i, 1)
        }
        prevAmmoCount = state.ammoPickups.length
        break
      }

      case 'cover_sync': {
        const cSet = new Set(msg.boxes.map((b: any) => `${b.x},${b.y},${b.type}`))
        for (let i = state.coverBoxes.length - 1; i >= 0; i--) {
          const c = state.coverBoxes[i]
          const key = `${Math.round(c.x)},${Math.round(c.y)},${c.type}`
          if (!cSet.has(key)) state.coverBoxes.splice(i, 1)
        }
        prevCoverCount = state.coverBoxes.length
        break
      }

      case 'platform_sync': {
        const pSet = new Set(msg.platforms.map((p: any) => `${p.x},${p.y},${p.w},${p.h}`))
        for (let i = platforms.length - 1; i >= 0; i--) {
          const p = platforms[i]
          if (!p.destructible) continue
          const key = `${p.x},${p.y},${p.w},${p.h}`
          if (!pSet.has(key)) {
            platforms.splice(i, 1)
          }
        }
        prevPlatformCount = platforms.length
        break
      }

      case 'bullets_spawn':
        for (const b of msg.bullets) {
          state.bullets.push({
            x: b.x, y: b.y,
            vx: b.vx, vy: b.vy,
            owner: b.o,
            life: 2,
            trail: [],
            damage: b.d,
            penetrate: b.p || false,
          })
        }
        break

      case 'pause':
        state.gameState = msg.paused ? 'paused' : 'playing'
        break

      case 'game_restart':
        // Other player triggered restart — apply their level data
        restart()
        SFX.startAmbient()
        setGeneratedLevel(msg.platforms, msg.spawnPositions)
        state.coverBoxes.length = 0
        for (const c of msg.coverBoxes) {
          state.coverBoxes.push({ ...c, vy: 0, falling: false })
        }
        state.weaponPickups.length = 0
        for (const w of msg.weaponPickups) {
          state.weaponPickups.push({ ...w, bobTimer: Math.random() * Math.PI * 2, collected: false })
        }
        // Reset all remote players
        for (let i = 1; i < state.players.length; i++) {
          const p = state.players[i]
          p.hp = 100; p.x = state.player.x + 50 * i; p.y = state.player.y
        }
        state.coopEnabled = true
        break
    }
  })
}

export function disconnect() {
  socket?.close()
  socket = null
  connected = false
  inRoom = false
  roomCode = ''
  state.coopEnabled = false
  state.players.length = 1
  remoteTargets.clear()
  enemyTargets.clear()
}

// ─── Send local player state ────────────────────────────────────────────────

export function sendPlayerState() {
  if (!socket || !connected || !inRoom || !state.coopEnabled) return
  const now = performance.now()
  if (now - lastSyncTime < 33) return // ~30fps sync
  lastSyncTime = now

  const p = state.player
  const aimWorldX = state.mouse.x + state.camera.x
  const aimWorldY = state.mouse.y + state.camera.y
  const aimAngle = Math.atan2(aimWorldY - (p.y + p.h / 2), aimWorldX - (p.x + p.w / 2))
  socket.send(JSON.stringify({
    type: 'player_state',
    pi: localPlayerIndex,
    x: Math.round(p.x),
    y: Math.round(p.y),
    vx: Math.round(p.vx),
    vy: Math.round(p.vy),
    hp: Math.round(p.hp),
    f: p.facing,
    g: p.onGround ? 1 : 0,
    c: p.crouching ? 1 : 0,
    d: p.diving ? 1 : 0,
    r: p.rolling ? 1 : 0,
    bt: p.bulletTimeActive ? 1 : 0,
    anim: state.currentAnim,
    at: Math.round(state.animTimer * 100) / 100,
    w: state.currentWeapon,
    aa: Math.round(aimAngle * 100) / 100,
  }))
}

// ─── Receive other player state ─────────────────────────────────────────────

// Map remote playerIndex to local players array slot (1, 2, 3...)
function remoteSlot(remoteIndex: number): number {
  // Local player is always players[0]. Remote players fill slots 1+ in order of their playerIndex.
  // We need a stable mapping: remote indices excluding our own, sorted.
  // Simplest: slot = remoteIndex < localPlayerIndex ? remoteIndex + 1 : remoteIndex
  // Actually even simpler — just use the remote index directly, skipping our own slot.
  return remoteIndex < localPlayerIndex ? remoteIndex + 1 : remoteIndex
}

function ensureRemotePlayer(remoteIndex: number) {
  const slot = remoteSlot(remoteIndex)
  while (state.players.length <= slot) {
    state.players.push(createPlayerState(state.players.length, state.player.x + 50 * state.players.length, state.player.y))
  }
}

function applyRemotePlayerState(msg: any) {
  const slot = remoteSlot(msg.pi)
  ensureRemotePlayer(msg.pi)
  state.coopEnabled = true

  const p = state.players[slot]

  // Store interpolation target
  remoteTargets.set(slot, { x: msg.x, y: msg.y, vx: msg.vx, vy: msg.vy })

  // Snap if far off
  if (Math.abs(msg.x - p.x) > 150 || Math.abs(msg.y - p.y) > 150) {
    p.x = msg.x; p.y = msg.y
  }

  p.hp = msg.hp; p.facing = msg.f
  p.onGround = msg.g === 1
  p.crouching = msg.c === 1
  p.diving = msg.d === 1
  p.rolling = msg.r === 1
  p.bulletTimeActive = msg.bt === 1
  if (msg.anim) p.currentAnim = msg.anim
  if (msg.at != null) p.animTimer = msg.at
  if (msg.w) p.currentWeapon = msg.w
  if (msg.aa != null) p.aimAngle = msg.aa
}

// Call this every frame to smoothly move remote player toward target
export function updateRemotePlayer(dt: number) {
  // Interpolate all remote players
  for (const [slot, target] of remoteTargets) {
    const p = state.players[slot]
    if (!p) continue
    p.x += target.vx * dt
    p.y += target.vy * dt
    const dx = target.x - p.x
    const dy = target.y - p.y
    p.x += dx * 8 * dt
    p.y += dy * 8 * dt
    p.vx = target.vx
    p.vy = target.vy
  }

  // Interpolate enemies on guest
  if (isOnline() && !isHost()) {
    for (const [i, target] of enemyTargets) {
      const e = state.enemies[i]
      if (!e || e.state === 'dead') { enemyTargets.delete(i); continue }
      // Move using velocity
      e.x += target.vx * dt
      e.y += target.vy * dt
      // Smoothly correct toward target
      const dx = target.x - e.x
      const dy = target.y - e.y
      e.x += dx * 10 * dt
      e.y += dy * 10 * dt
    }
  }
}

// ─── Game start sync (host → guest) ────────────────────────────────────────

function sendGameStart(targetPlayerIndex?: number) {
  if (!socket || !connected) return
  socket.send(JSON.stringify({
    type: 'game_start',
    ...(targetPlayerIndex != null ? { _target: targetPlayerIndex } : {}),
    wave: state.wave,
    waveState: state.waveState,
    gameState: state.gameState,
    platforms: platforms.map(p => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
      ...(p.destructible ? { destructible: true, hp: p.hp, maxHp: p.maxHp } : {}),
    })),
    spawnPositions: spawnPositions.map(s => ({ x: s.x, y: s.y })),
    coverBoxes: state.coverBoxes.map(c => ({
      x: c.x, y: c.y, w: c.w, h: c.h, hp: c.hp, maxHp: c.maxHp, type: c.type,
    })),
    weaponPickups: state.weaponPickups.map(w => ({
      x: w.x, y: w.y, w: w.w, h: w.h, type: w.type,
    })),
    enemies: state.enemies.filter(e => e.state !== 'dead').map(e => ({
      x: e.x, y: e.y, behavior: e.behavior,
    })),
  }))
}

function applyGameStart(msg: any) {
  // Apply host's level data
  setGeneratedLevel(msg.platforms, msg.spawnPositions)

  state.coverBoxes.length = 0
  for (const c of msg.coverBoxes) {
    state.coverBoxes.push({ ...c, vy: 0, falling: false })
  }

  state.weaponPickups.length = 0
  for (const w of msg.weaponPickups) {
    state.weaponPickups.push({ ...w, bobTimer: Math.random() * Math.PI * 2, collected: false })
  }

  // Apply enemies if included (late joiner gets current enemy state)
  if (msg.enemies && msg.enemies.length > 0) {
    state.enemies.length = 0
    const wave = msg.wave || 1
    const diff = 1 + (wave - 1) * 0.1
    for (const e of msg.enemies) {
      const cfg = ENEMY_CONFIGS[e.behavior as keyof typeof ENEMY_CONFIGS]
      const scaledHp = Math.round(cfg.hp * diff)
      state.enemies.push({
        x: e.x, y: e.y,
        w: e.behavior === 'boss' ? 36 : e.behavior === 'drone' ? 16 : 24,
        h: e.behavior === 'boss' ? 56 : e.behavior === 'drone' ? 16 : 44,
        hp: scaledHp, maxHp: scaledHp,
        vx: 0, vy: 0, onGround: false, facing: -1,
        shootTimer: Math.random() * cfg.shootInterval,
        alertTimer: 0, state: 'idle' as const, deathTimer: 0,
        patrolDir: Math.random() > 0.5 ? 1 : -1,
        patrolTimer: Math.random() * 3 + 1,
        type: e.behavior === 'grunt' ? 'thug' : 'grunt',
        behavior: e.behavior,
        animTimer: 0, currentAnim: 'idle' as const, hitTimer: 0, showHpTimer: 0,
      })
    }
  }

  // Sync wave/game state
  if (msg.wave != null) state.wave = msg.wave
  if (msg.waveState) state.waveState = msg.waveState

  state.coopEnabled = true
  startMultiplayerGame()
}

// Called every frame — detects state changes and syncs them
export function syncGameEvents() {
  if (!socket || !connected || !inRoom || !state.coopEnabled) return

  // Enemy kills
  const killed: number[] = []
  for (let i = 0; i < state.enemies.length; i++) {
    const dead = state.enemies[i].state === 'dead'
    if (dead && prevAlive[i]) killed.push(i)
    prevAlive[i] = !dead
  }
  if (killed.length > 0) {
    socket.send(JSON.stringify({ type: 'enemy_kill', indices: killed }))
  }

  // Weapon pickups collected
  const weaponsCollected: number[] = []
  for (let i = 0; i < state.weaponPickups.length; i++) {
    const collected = state.weaponPickups[i].collected
    if (collected && !prevWeaponCollected[i]) weaponsCollected.push(i)
    prevWeaponCollected[i] = collected
  }
  if (weaponsCollected.length > 0) {
    socket.send(JSON.stringify({ type: 'weapon_collected', indices: weaponsCollected }))
  }

  // Health pickups removed (count decreased)
  if (state.healthPickups.length < prevHealthCount) {
    // We can't know exactly which indices were removed after the fact,
    // so we send the full remaining set for the other client to match
    socket.send(JSON.stringify({
      type: 'health_sync',
      pickups: state.healthPickups.map(h => ({ x: Math.round(h.x), y: Math.round(h.y) })),
    }))
  }
  prevHealthCount = state.healthPickups.length

  // Ammo pickups removed
  if (state.ammoPickups.length < prevAmmoCount) {
    socket.send(JSON.stringify({
      type: 'ammo_sync',
      pickups: state.ammoPickups.map(a => ({ x: Math.round(a.x), y: Math.round(a.y), wt: a.weaponType, amt: a.amount })),
    }))
  }
  prevAmmoCount = state.ammoPickups.length

  // Cover boxes destroyed
  if (state.coverBoxes.length < prevCoverCount) {
    socket.send(JSON.stringify({
      type: 'cover_sync',
      boxes: state.coverBoxes.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), type: c.type, hp: c.hp })),
    }))
  }
  prevCoverCount = state.coverBoxes.length

  // Platforms destroyed
  if (platforms.length < prevPlatformCount) {
    socket.send(JSON.stringify({
      type: 'platform_sync',
      platforms: platforms.filter(p => p.destructible).map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
    }))
  }
  prevPlatformCount = platforms.length

  // Flush pending bullet spawns
  if (pendingBullets.length > 0) {
    socket.send(JSON.stringify({
      type: 'bullets_spawn',
      bullets: pendingBullets.map(b => ({
        x: Math.round(b.x), y: Math.round(b.y),
        vx: Math.round(b.vx), vy: Math.round(b.vy),
        o: b.owner, d: b.damage, p: b.penetrate ? 1 : 0,
      })),
    }))
    pendingBullets.length = 0
  }

  // Host sends enemy positions at ~10fps
  if (isHost()) {
    const now = performance.now()
    if (now - lastEnemySyncTime > 100) {
      lastEnemySyncTime = now
      const enemies: any[] = []
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i]
        if (e.state === 'dead') continue
        enemies.push({
          i, x: Math.round(e.x), y: Math.round(e.y),
          vx: Math.round(e.vx), vy: Math.round(e.vy),
          f: e.facing, hp: e.hp, s: e.state,
        })
      }
      if (enemies.length > 0) {
        socket.send(JSON.stringify({ type: 'enemy_sync', enemies }))
      }
    }
  }
}

export function sendWaveLevel(wave: number) {
  if (!socket || !connected) return
  socket.send(JSON.stringify({
    type: 'wave_level',
    wave,
    platforms: platforms.map(p => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
      ...(p.destructible ? { destructible: true, hp: p.hp, maxHp: p.maxHp } : {}),
    })),
    spawnPositions: spawnPositions.map(s => ({ x: s.x, y: s.y })),
    coverBoxes: state.coverBoxes.map(c => ({
      x: c.x, y: c.y, w: c.w, h: c.h, hp: c.hp, maxHp: c.maxHp, type: c.type,
    })),
    weaponPickups: state.weaponPickups.map(w => ({
      x: w.x, y: w.y, w: w.w, h: w.h, type: w.type,
    })),
    enemies: state.enemies.map(e => ({
      x: e.x, y: e.y, behavior: e.behavior,
    })),
  }))
}

function applyWaveLevel(msg: any) {
  // Respawn dead player at wave start
  if (state.player.hp <= 0) {
    respawnPlayer()
  }
  state.wave = msg.wave
  setGeneratedLevel(msg.platforms, msg.spawnPositions)

  state.coverBoxes.length = 0
  for (const c of msg.coverBoxes) {
    state.coverBoxes.push({ ...c, vy: 0, falling: false })
  }

  state.weaponPickups.length = 0
  for (const w of msg.weaponPickups) {
    state.weaponPickups.push({ ...w, bobTimer: Math.random() * Math.PI * 2, collected: false })
  }

  // Spawn enemies from host's data (inlined to avoid circular dep with waves.ts)
  state.enemies.length = 0
  const diff = 1 + (state.wave - 1) * 0.1
  for (const e of msg.enemies) {
    const cfg = ENEMY_CONFIGS[e.behavior as keyof typeof ENEMY_CONFIGS]
    const scaledHp = Math.round(cfg.hp * diff)
    state.enemies.push({
      x: e.x, y: e.y,
      w: e.behavior === 'boss' ? 36 : e.behavior === 'drone' ? 16 : 24,
      h: e.behavior === 'boss' ? 56 : e.behavior === 'drone' ? 16 : 44,
      hp: scaledHp, maxHp: scaledHp,
      vx: 0, vy: 0, onGround: false, facing: -1,
      shootTimer: Math.random() * cfg.shootInterval,
      alertTimer: 0, state: 'idle' as const, deathTimer: 0,
      patrolDir: Math.random() > 0.5 ? 1 : -1,
      patrolTimer: Math.random() * 3 + 1,
      type: e.behavior === 'grunt' ? 'thug' : 'grunt',
      behavior: e.behavior,
      animTimer: 0, currentAnim: 'idle' as const, hitTimer: 0, showHpTimer: 0,
    })
  }

  state.waveState = 'active'
  state.invincibleTimer = 1.0
  state.reinforcementsSent = false
  state.waveEnemiesAlive = state.enemies.filter((e: any) => e.state !== 'dead').length
}

function startMultiplayerGame() {
  if (state.gameState !== 'playing') {
    state.gameState = 'playing'
    SFX.startAmbient()
  }
}

// ─── Pause sync ────────────────────────────────────────────────────────────

export function sendPause(paused: boolean) {
  if (!socket || !connected || !inRoom) return
  socket.send(JSON.stringify({ type: 'pause', paused, pi: localPlayerIndex }))
}

// ─── Restart sync ──────────────────────────────────────────────────────────

export function sendRestart() {
  if (!socket || !connected) return
  socket.send(JSON.stringify({
    type: 'game_restart',
    platforms: platforms.map(p => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
      ...(p.destructible ? { destructible: true, hp: p.hp, maxHp: p.maxHp } : {}),
    })),
    spawnPositions: spawnPositions.map(s => ({ x: s.x, y: s.y })),
    coverBoxes: state.coverBoxes.map(c => ({
      x: c.x, y: c.y, w: c.w, h: c.h, hp: c.hp, maxHp: c.maxHp, type: c.type,
    })),
    weaponPickups: state.weaponPickups.map(w => ({
      x: w.x, y: w.y, w: w.w, h: w.h, type: w.type,
    })),
  }))
}

// ─── Bullet sync ───────────────────────────────────────────────────────────

export function queueBulletSync(b: { x: number; y: number; vx: number; vy: number; owner: string; damage: number; penetrate?: boolean }) {
  if (!inRoom || !state.coopEnabled) return
  pendingBullets.push(b)
}

// ─── Getters ────────────────────────────────────────────────────────────────

export function getRoomCode(): string { return roomCode }
export function isConnected(): boolean { return connected }
export function isOnline(): boolean { return inRoom }
export function isHost(): boolean { return localPlayerIndex === 0 }
export function isGuest(): boolean { return localPlayerIndex === 1 }
export function getRole() { return inRoom ? (localPlayerIndex === 0 ? 'host' : 'guest') : 'none' }
export function getLocalPlayerIndex() { return localPlayerIndex }

export function setOnRoomListUpdate(cb: (rooms: string[]) => void) { onRoomListUpdate = cb }
export function setOnStatusChange(cb: (status: string) => void) { onStatusChange = cb }

// Legacy exports for compatibility
export function setOnGuestInput(_cb: any) {}
export type GuestInputPacket = any
export function sendGuestInput(_input: any) {}
export function sendStateSync() { sendPlayerState() }
