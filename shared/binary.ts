// ─── Binary Protocol for High-Frequency Messages ────────────────────────────
// Replaces JSON for the per-tick messages: enemy update, player states, enemy bullets
// Format: [u8 msgType] [u8 count] [payload...]
// Positions: int16 (range -32768..32767, plenty for 2400px level)
// Flags: bit-packed into single bytes

export const MSG = {
  // Server → Client
  ENEMY_UPDATE: 1,
  PLAYER_STATES: 2,
  ENEMY_BULLETS: 3,
  ENEMY_KILLED: 4,
  ENEMY_HIT: 5,
  FRAME: 6,          // Batched frame: multiple sub-messages in one packet
  PLAYER_BULLETS: 7,  // Server → Client (other players' bullets)
  // Client → Server
  C_PLAYER_STATE: 10,
  C_ENEMY_DAMAGE: 11,
  C_PLAYER_BULLETS: 12,
} as const

// ─── Lookup Tables ──────────────────────────────────────────────────────────

const ANIM_IDS: Record<string, number> = { idle: 0, run: 1, jump: 2, fall: 3, dive: 4, crouch: 5, uncrouch: 6, roll: 7, pickup: 8, land: 9, death: 10 }
const ANIM_NAMES = ['idle', 'run', 'jump', 'fall', 'dive', 'crouch', 'uncrouch', 'roll', 'pickup', 'land', 'death']
const WEAPON_IDS: Record<string, number> = { pistol: 0, shotgun: 1, m16: 2, sniper: 3, grenades: 4 }
const WEAPON_NAMES = ['pistol', 'shotgun', 'm16', 'sniper', 'grenades']

// ─── Enemy Update (14 bytes/enemy) ──────────────────────────────────────────
// Per enemy: [u16 idx, i16 x, i16 y, i16 vx, i16 vy, i8 facing, u16 hp, u8 flags]

export function encodeEnemyUpdate(enemies: { i: number; x: number; y: number; vx: number; vy: number; facing: number; hp: number; alert: boolean }[]): ArrayBuffer {
  const buf = new ArrayBuffer(2 + enemies.length * 14)
  const v = new DataView(buf)
  v.setUint8(0, MSG.ENEMY_UPDATE)
  v.setUint8(1, enemies.length)
  let o = 2
  for (const e of enemies) {
    v.setUint16(o, e.i); v.setInt16(o + 2, e.x); v.setInt16(o + 4, e.y)
    v.setInt16(o + 6, e.vx); v.setInt16(o + 8, e.vy)
    v.setInt8(o + 10, e.facing); v.setUint16(o + 11, e.hp)
    v.setUint8(o + 13, e.alert ? 1 : 0)
    o += 14
  }
  return buf
}

export function decodeEnemyUpdate(buf: ArrayBuffer) {
  const v = new DataView(buf)
  const count = v.getUint8(1)
  const result: { i: number; x: number; y: number; vx: number; vy: number; facing: number; hp: number; alert: boolean }[] = []
  let o = 2
  for (let n = 0; n < count; n++) {
    result.push({
      i: v.getUint16(o), x: v.getInt16(o + 2), y: v.getInt16(o + 4),
      vx: v.getInt16(o + 6), vy: v.getInt16(o + 8),
      facing: v.getInt8(o + 10), hp: v.getUint16(o + 11),
      alert: v.getUint8(o + 13) === 1,
    })
    o += 14
  }
  return result
}

// ─── Player States (17 bytes/player) ────────────────────────────────────────
// [u8 pi, i16 x, i16 y, i16 vx, i16 vy, u8 hp, i8 facing, u8 flags, u8 animId, u8 animTimer*20, u8 weaponId, i16 aimAngle*100]
// flags: bit0=ground, bit1=crouch, bit2=dive, bit3=roll, bit4=bulletTime

export function encodePlayerStates(players: { pi: number; x: number; y: number; vx: number; vy: number; hp: number; facing: number; ground: boolean; crouch: boolean; dive: boolean; roll: boolean; bt: boolean; anim: string; animTimer: number; weapon: string; aimAngle: number }[]): ArrayBuffer {
  const buf = new ArrayBuffer(2 + players.length * 17)
  const v = new DataView(buf)
  v.setUint8(0, MSG.PLAYER_STATES)
  v.setUint8(1, players.length)
  let o = 2
  for (const p of players) {
    v.setUint8(o, p.pi)
    v.setInt16(o + 1, p.x); v.setInt16(o + 3, p.y)
    v.setInt16(o + 5, p.vx); v.setInt16(o + 7, p.vy)
    v.setUint8(o + 9, Math.max(0, Math.min(255, p.hp)))
    v.setInt8(o + 10, p.facing)
    v.setUint8(o + 11, (p.ground ? 1 : 0) | (p.crouch ? 2 : 0) | (p.dive ? 4 : 0) | (p.roll ? 8 : 0) | (p.bt ? 16 : 0))
    v.setUint8(o + 12, ANIM_IDS[p.anim] ?? 0)
    v.setUint8(o + 13, Math.round(p.animTimer * 20) & 0xFF)
    v.setUint8(o + 14, WEAPON_IDS[p.weapon] ?? 0)
    v.setInt16(o + 15, Math.round(p.aimAngle * 100))
    o += 17
  }
  return buf
}

export function decodePlayerStates(buf: ArrayBuffer) {
  const v = new DataView(buf)
  const count = v.getUint8(1)
  const result: { pi: number; x: number; y: number; vx: number; vy: number; hp: number; f: number; g: number; c: number; d: number; r: number; bt: number; anim: string; at: number; w: string; aa: number }[] = []
  let o = 2
  for (let n = 0; n < count; n++) {
    const flags = v.getUint8(o + 11)
    result.push({
      pi: v.getUint8(o),
      x: v.getInt16(o + 1), y: v.getInt16(o + 3),
      vx: v.getInt16(o + 5), vy: v.getInt16(o + 7),
      hp: v.getUint8(o + 9), f: v.getInt8(o + 10),
      g: flags & 1, c: (flags >> 1) & 1, d: (flags >> 2) & 1,
      r: (flags >> 3) & 1, bt: (flags >> 4) & 1,
      anim: ANIM_NAMES[v.getUint8(o + 12)] || 'idle',
      at: v.getUint8(o + 13) / 20,
      w: WEAPON_NAMES[v.getUint8(o + 14)] || 'pistol',
      aa: v.getInt16(o + 15) / 100,
    })
    o += 17
  }
  return result
}

// ─── Enemy Bullets (9 bytes/bullet) ─────────────────────────────────────────
// [i16 x, i16 y, i16 vx, i16 vy, u8 damage]

export function encodeEnemyBullets(bullets: { x: number; y: number; vx: number; vy: number; d: number }[]): ArrayBuffer {
  const buf = new ArrayBuffer(2 + bullets.length * 9)
  const v = new DataView(buf)
  v.setUint8(0, MSG.ENEMY_BULLETS)
  v.setUint8(1, bullets.length)
  let o = 2
  for (const b of bullets) {
    v.setInt16(o, b.x); v.setInt16(o + 2, b.y)
    v.setInt16(o + 4, b.vx); v.setInt16(o + 6, b.vy)
    v.setUint8(o + 8, b.d)
    o += 9
  }
  return buf
}

export function decodeEnemyBullets(buf: ArrayBuffer) {
  const v = new DataView(buf)
  const count = v.getUint8(1)
  const result: { x: number; y: number; vx: number; vy: number; d: number }[] = []
  let o = 2
  for (let n = 0; n < count; n++) {
    result.push({
      x: v.getInt16(o), y: v.getInt16(o + 2),
      vx: v.getInt16(o + 4), vy: v.getInt16(o + 6),
      d: v.getUint8(o + 8),
    })
    o += 9
  }
  return result
}

// ─── Player Bullets (9 bytes/bullet) — same layout, different msg type ──────

export function encodePlayerBullets(bullets: { x: number; y: number; vx: number; vy: number; d: number }[]): ArrayBuffer {
  const buf = new ArrayBuffer(2 + bullets.length * 9)
  const v = new DataView(buf)
  v.setUint8(0, MSG.PLAYER_BULLETS)
  v.setUint8(1, bullets.length)
  let o = 2
  for (const b of bullets) {
    v.setInt16(o, b.x); v.setInt16(o + 2, b.y)
    v.setInt16(o + 4, b.vx); v.setInt16(o + 6, b.vy)
    v.setUint8(o + 8, b.d)
    o += 9
  }
  return buf
}

export function encodeClientPlayerBullets(bullets: { x: number; y: number; vx: number; vy: number; d: number }[]): ArrayBuffer {
  const buf = new ArrayBuffer(2 + bullets.length * 9)
  const v = new DataView(buf)
  v.setUint8(0, MSG.C_PLAYER_BULLETS)
  v.setUint8(1, bullets.length)
  let o = 2
  for (const b of bullets) {
    v.setInt16(o, b.x); v.setInt16(o + 2, b.y)
    v.setInt16(o + 4, b.vx); v.setInt16(o + 6, b.vy)
    v.setUint8(o + 8, b.d)
    o += 9
  }
  return buf
}

// Shared decoder works for both ENEMY_BULLETS, PLAYER_BULLETS, and C_PLAYER_BULLETS
export function decodeBullets(buf: ArrayBuffer) {
  const v = new DataView(buf)
  const count = v.getUint8(1)
  const result: { x: number; y: number; vx: number; vy: number; d: number }[] = []
  let o = 2
  for (let n = 0; n < count; n++) {
    result.push({ x: v.getInt16(o), y: v.getInt16(o + 2), vx: v.getInt16(o + 4), vy: v.getInt16(o + 6), d: v.getUint8(o + 8) })
    o += 9
  }
  return result
}

// ─── Small Event Messages ───────────────────────────────────────────────────

export function encodeEnemyKilled(index: number, killerPi = -1): ArrayBuffer {
  const buf = new ArrayBuffer(4)
  const v = new DataView(buf)
  v.setUint8(0, MSG.ENEMY_KILLED); v.setUint16(1, index)
  v.setInt8(3, killerPi)
  return buf
}

export function encodeEnemyHit(index: number, hp: number): ArrayBuffer {
  const buf = new ArrayBuffer(5)
  const v = new DataView(buf)
  v.setUint8(0, MSG.ENEMY_HIT); v.setUint16(1, index); v.setUint16(3, hp)
  return buf
}

export function decodeMsgType(buf: ArrayBuffer): number {
  return new DataView(buf).getUint8(0)
}

export function decodeEnemyKilled(buf: ArrayBuffer): { index: number; killerPi: number } {
  const v = new DataView(buf)
  return { index: v.getUint16(1), killerPi: v.getInt8(3) }
}

export function decodeEnemyHit(buf: ArrayBuffer): { index: number; hp: number } {
  const v = new DataView(buf)
  return { index: v.getUint16(1), hp: v.getUint16(3) }
}

// ─── Client → Server: Player State (19 bytes) ──────────────────────────────
// [u8 MSG, u8 pi, i16 x, i16 y, i16 vx, i16 vy, u8 hp, i8 facing, u8 flags, u8 animId, u8 animTimer*20, u8 weaponId, i16 aimAngle*100]

export function encodeClientPlayerState(p: { pi: number; x: number; y: number; vx: number; vy: number; hp: number; facing: number; ground: boolean; crouch: boolean; dive: boolean; roll: boolean; bt: boolean; anim: string; animTimer: number; weapon: string; aimAngle: number }): ArrayBuffer {
  const buf = new ArrayBuffer(19)
  const v = new DataView(buf)
  v.setUint8(0, MSG.C_PLAYER_STATE)
  v.setUint8(1, p.pi)
  v.setInt16(2, p.x); v.setInt16(4, p.y)
  v.setInt16(6, p.vx); v.setInt16(8, p.vy)
  v.setUint8(10, Math.max(0, Math.min(255, p.hp)))
  v.setInt8(11, p.facing)
  v.setUint8(12, (p.ground ? 1 : 0) | (p.crouch ? 2 : 0) | (p.dive ? 4 : 0) | (p.roll ? 8 : 0) | (p.bt ? 16 : 0))
  v.setUint8(13, ANIM_IDS[p.anim] ?? 0)
  v.setUint8(14, Math.round(p.animTimer * 20) & 0xFF)
  v.setUint8(15, WEAPON_IDS[p.weapon] ?? 0)
  v.setInt16(16, Math.round(p.aimAngle * 100))
  // byte 18 = padding for alignment (total 19)
  return buf
}

export function decodeClientPlayerState(buf: ArrayBuffer, offset = 0): { pi: number; x: number; y: number; vx: number; vy: number; hp: number; facing: number; onGround: boolean; crouching: boolean; diving: boolean; rolling: boolean; bulletTimeActive: boolean; anim: string; animTimer: number; weapon: string; aimAngle: number } {
  const v = new DataView(buf)
  const o = offset + 1 // skip msgType
  const flags = v.getUint8(o + 11)
  return {
    pi: v.getUint8(o),
    x: v.getInt16(o + 1), y: v.getInt16(o + 3),
    vx: v.getInt16(o + 5), vy: v.getInt16(o + 7),
    hp: v.getUint8(o + 9), facing: v.getInt8(o + 10),
    onGround: !!(flags & 1), crouching: !!(flags & 2),
    diving: !!(flags & 4), rolling: !!(flags & 8),
    bulletTimeActive: !!(flags & 16),
    anim: ANIM_NAMES[v.getUint8(o + 12)] || 'idle',
    animTimer: v.getUint8(o + 13) / 20,
    weapon: WEAPON_NAMES[v.getUint8(o + 14)] || 'pistol',
    aimAngle: v.getInt16(o + 15) / 100,
  }
}

// ─── Client → Server: Enemy Damage (6 bytes) ───────────────────────────────
// [u8 MSG, u16 enemyIdx, u16 damage*10, u8 headshot]

export function encodeEnemyDamage(enemyIdx: number, damage: number, headshot: boolean): ArrayBuffer {
  const buf = new ArrayBuffer(6)
  const v = new DataView(buf)
  v.setUint8(0, MSG.C_ENEMY_DAMAGE)
  v.setUint16(1, enemyIdx)
  v.setUint16(3, Math.round(damage * 10))
  v.setUint8(5, headshot ? 1 : 0)
  return buf
}

export function decodeEnemyDamage(buf: ArrayBuffer): { enemyIdx: number; damage: number; headshot: boolean } {
  const v = new DataView(buf)
  return { enemyIdx: v.getUint16(1), damage: v.getUint16(3) / 10, headshot: v.getUint8(5) === 1 }
}

// ─── Server Frame Batching ──────────────────────────────────────────────────
// Packs multiple binary sub-messages into one WebSocket frame
// Format: [u8 FRAME] [u16 totalLen] [u16 msg1Len] [msg1Bytes...] [u16 msg2Len] [msg2Bytes...] ...

export function encodeFrame(messages: ArrayBuffer[]): ArrayBuffer {
  let totalPayload = 0
  for (const m of messages) totalPayload += 2 + m.byteLength // 2 bytes length prefix per sub-msg
  const buf = new ArrayBuffer(3 + totalPayload)
  const v = new DataView(buf)
  const u8 = new Uint8Array(buf)
  v.setUint8(0, MSG.FRAME)
  v.setUint16(1, messages.length)
  let off = 3
  for (const m of messages) {
    v.setUint16(off, m.byteLength); off += 2
    u8.set(new Uint8Array(m), off); off += m.byteLength
  }
  return buf
}

export function decodeFrame(buf: ArrayBuffer): ArrayBuffer[] {
  const v = new DataView(buf)
  const count = v.getUint16(1)
  const result: ArrayBuffer[] = []
  let off = 3
  for (let i = 0; i < count; i++) {
    const len = v.getUint16(off); off += 2
    result.push(buf.slice(off, off + len)); off += len
  }
  return result
}
