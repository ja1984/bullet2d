// ─── Network Protocol (shared message types) ───────────────────────────────

import type { Rect, Vec2, CoverBox, WeaponType, ServerEnemy, ServerBullet, WeaponPickup } from './types'

// ─── Client → Server ────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'player_state'; pi: number; x: number; y: number; vx: number; vy: number; hp: number; f: number; g: number; c: number; d: number; r: number; bt: number; anim: string; at: number; w: string; aa: number }
  | { type: 'enemy_damage'; enemyIdx: number; damage: number; headshot: boolean }
  | { type: 'pause'; paused: boolean }
  | { type: 'request_restart' }

// ─── Server → Client ────────────────────────────────────────────────────────

export interface EnemySnapshot {
  i: number; x: number; y: number; vx: number; vy: number
  f: number; hp: number; s: string
}

export interface BulletSpawn {
  x: number; y: number; vx: number; vy: number
  o: string; d: number; p: number
}

export type ServerMessage =
  | { type: 'welcome'; playerIndex: number; roomCode: string; playerCount: number }
  | { type: 'player_joined'; playerIndex: number }
  | { type: 'player_left'; playerIndex: number }
  | { type: 'game_state'; wave: number; waveState: string; platforms: Rect[]; spawnPositions: Vec2[]; coverBoxes: CoverBox[]; weaponPickups: { x: number; y: number; w: number; h: number; type: WeaponType; collected: boolean }[]; enemies: ServerEnemy[] }
  | { type: 'enemy_update'; enemies: EnemySnapshot[] }
  | { type: 'enemy_bullets'; bullets: BulletSpawn[] }
  | { type: 'enemy_killed'; index: number }
  | { type: 'enemy_hit'; index: number; hp: number }
  | { type: 'wave_countdown'; wave: number; timer: number }
  | { type: 'wave_start'; wave: number; platforms: Rect[]; spawnPositions: Vec2[]; coverBoxes: CoverBox[]; weaponPickups: { x: number; y: number; w: number; h: number; type: WeaponType; collected: boolean }[]; enemies: ServerEnemy[] }
  | { type: 'wave_cleared' }
  | { type: 'cover_destroyed'; x: number; y: number; coverType: string; explosive: boolean }
  | { type: 'platform_destroyed'; x: number; y: number; w: number; h: number }
  | { type: 'weapon_collected'; index: number }
  | { type: 'player_states'; players: { pi: number; x: number; y: number; vx: number; vy: number; hp: number; f: number; g: number; c: number; d: number; r: number; bt: number; anim: string; at: number; w: string; aa: number }[] }
  | { type: 'pause'; paused: boolean }
  | { type: 'game_restart'; platforms: Rect[]; spawnPositions: Vec2[]; coverBoxes: CoverBox[]; weaponPickups: { x: number; y: number; w: number; h: number; type: WeaponType; collected: boolean }[]; enemies: ServerEnemy[] }
  | { type: 'error'; message: string }
