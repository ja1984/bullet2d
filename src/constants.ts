// ─── Constants ───────────────────────────────────────────────────────────────

import type { EnemyBehavior, PlayerAnim, Rect, Vec2, WeaponDef, WeaponType } from './types'

// Arm sprite config
export const ARM_ANCHOR_X = 4   // shoulder offset from body sprite center (right)
export const ARM_ANCHOR_Y = -4  // shoulder offset from body sprite center (up)
export const ARM_PIVOT_X = 34   // pivot point in 68x68 arm sprite (from left)
export const ARM_PIVOT_Y = 30   // pivot point in 68x68 arm sprite (from top)
export const ARM_HAND_X = 36    // hand/grip position in 68x68 arm sprite (from left)
export const ARM_HAND_Y = 45    // hand/grip position in 68x68 arm sprite (from top)

export const CANVAS_W = 1280
export const CANVAS_H = 720
export const GRAVITY = 1800
export const PLAYER_SPEED = 280
export const PLAYER_JUMP = 460
export const DIVE_SPEED = 500
export const DIVE_DURATION = 0.5
export const BULLET_LIFE = 2
export const BULLET_TIME_SCALE = 0.2
export const BULLET_TIME_MAX = 10
export const BULLET_TIME_RECHARGE = 0.8
export const ENEMY_SHOOT_INTERVAL = 1.5
export const ENEMY_BULLET_SPEED = 500
export const ENEMY_SIGHT_RANGE = 500
export const PLAYER_MAX_HP = 100
export const DOUBLE_TAP_WINDOW = 0.25
export const COMBO_WINDOW = 2.0

export const SPRITE_FRAME_SIZE = 68
export const DIVE_SPRITE_Y_OFFSET = 25
export const ENEMY_SPRITE_FRAME_SIZE = 68

// ─── Weapon Definitions ─────────────────────────────────────────────────────

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  pistol: {
    name: 'PISTOL',
    fireRate: 0.12,
    bulletSpeed: 900,
    damage: 15,
    pellets: 1,
    spread: 0,
    shake: 3,
    color: '#ffc832',
    ammo: -1,
    auto: false,
    magSize: 12,
    reloadTime: 1.0,
  },
  shotgun: {
    name: 'SHOTGUN',
    fireRate: 0.3,
    bulletSpeed: 800,
    damage: 12,
    pellets: 7,
    spread: 0.18,
    shake: 8,
    color: '#ff8844',
    ammo: 16,
    auto: false,
    magSize: 6,
    reloadTime: 1.5,
  },
  m16: {
    name: 'M16',
    fireRate: 0.05,
    bulletSpeed: 850,
    damage: 8,
    pellets: 1,
    spread: 0.08,
    shake: 2,
    color: '#44ddff',
    ammo: 60,
    auto: true,
    magSize: 30,
    reloadTime: 1.8,
  },
  sniper: {
    name: 'SNIPER',
    fireRate: 1.2,
    bulletSpeed: 1200,
    damage: 45,
    pellets: 1,
    spread: 0,
    shake: 12,
    color: '#aa44ff',
    ammo: 10,
    auto: false,
    magSize: 5,
    reloadTime: 2.2,
  },
}

// ─── Sprite Config ──────────────────────────────────────────────────────────

export const spriteConfig: Record<PlayerAnim, { frames: number; fps: number }> = {
  idle:   { frames: 4, fps: 6 },
  run:    { frames: 8, fps: 14 },
  jump:   { frames: 6, fps: 18 },
  land:   { frames: 3, fps: 12 },
  fall:   { frames: 9, fps: 12 },
  dive:   { frames: 5, fps: 10 },
  crouch:   { frames: 3, fps: 20 },
  uncrouch: { frames: 2, fps: 15 },
  roll:   { frames: 2, fps: 8 },
  pickup: { frames: 5, fps: 10 },
}

// ─── Enemy Configs ──────────────────────────────────────────────────────────

export const ENEMY_CONFIGS: Record<EnemyBehavior, { hp: number; speed: number; shootInterval: number; bulletSpeed: number; damage: number; pellets: number; spread: number; sightRange: number }> = {
  grunt:      { hp: 60,  speed: 60,  shootInterval: 1.5, bulletSpeed: 500, damage: 8,  pellets: 1, spread: 0,    sightRange: 500 },
  shotgunner: { hp: 80,  speed: 40,  shootInterval: 2.0, bulletSpeed: 400, damage: 6,  pellets: 5, spread: 0.15, sightRange: 350 },
  sniper:     { hp: 40,  speed: 30,  shootInterval: 2.5, bulletSpeed: 800, damage: 20, pellets: 1, spread: 0,    sightRange: 800 },
  rusher:     { hp: 50,  speed: 160, shootInterval: 0.8, bulletSpeed: 450, damage: 6,  pellets: 1, spread: 0.1,  sightRange: 600 },
  boss:       { hp: 500, speed: 50,  shootInterval: 0.6, bulletSpeed: 550, damage: 12, pellets: 3, spread: 0.12, sightRange: 700 },
}

// ─── Level ──────────────────────────────────────────────────────────────────

export const platforms: Rect[] = [
  // Ground
  { x: 0, y: 620, w: 2400, h: 100 },
  // Platforms
  { x: 200, y: 500, w: 200, h: 20 },
  { x: 500, y: 420, w: 250, h: 20 },
  { x: 850, y: 350, w: 200, h: 20 },
  { x: 1100, y: 470, w: 180, h: 20 },
  { x: 1400, y: 380, w: 220, h: 20 },
  { x: 1700, y: 300, w: 200, h: 20 },
  { x: 1500, y: 530, w: 250, h: 20 },
  { x: 300, y: 300, w: 150, h: 20 },
  { x: 50, y: 400, w: 120, h: 20 },
  // Walls
  { x: 0, y: 0, w: 20, h: 720 },
  { x: 2380, y: 0, w: 20, h: 720 },
]

export const spawnPositions: Vec2[] = [
  { x: 450, y: 570 }, { x: 700, y: 570 }, { x: 550, y: 370 },
  { x: 900, y: 300 }, { x: 1150, y: 420 }, { x: 1450, y: 330 },
  { x: 1750, y: 250 }, { x: 1550, y: 480 }, { x: 1900, y: 570 },
  { x: 2100, y: 570 }, { x: 300, y: 250 }, { x: 100, y: 570 },
]
