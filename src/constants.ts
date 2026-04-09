// ─── Constants ───────────────────────────────────────────────────────────────

import type { EnemyBehavior, PlayerAnim, Rect, Vec2, WeaponDef, WeaponType } from './types'

// Arm sprite config
export const ARM_ANCHOR_X = 4   // shoulder offset from body sprite center (right)
export const ARM_ANCHOR_Y = -4  // shoulder offset from body sprite center (up)
export const ARM_PIVOT_X = 34   // pivot point in 68x68 arm sprite (from left)
export const ARM_PIVOT_Y = 30   // pivot point in 68x68 arm sprite (from top)
export const ARM_HAND_X = 36    // hand/grip position in 68x68 arm sprite (from left)
export const ARM_HAND_Y = 45    // hand/grip position in 68x68 arm sprite (from top)

export const WALL_SLIDE_SPEED = 60    // max fall speed while wall sliding
export const WALL_JUMP_FORCE_X = 300  // horizontal push off wall
export const WALL_JUMP_FORCE_Y = 420  // vertical jump force off wall

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
  grenades: {
    name: 'GRENADES',
    fireRate: 0.8,
    bulletSpeed: 800,
    damage: 80,
    pellets: 1,
    spread: 0,
    shake: 4,
    color: '#88cc44',
    ammo: 3,
    auto: false,
    magSize: 1,
    reloadTime: 0.5,
  },
}

export const GRENADE_FUSE = 1.5       // seconds before explosion
export const GRENADE_RADIUS = 100     // explosion radius
export const GRENADE_BOUNCE_DAMP = 0.5 // velocity kept after bounce

// ─── Sprite Config ──────────────────────────────────────────────────────────

export type PlayerSkin = 'default' | 'pringlan'

export interface SkinDef {
  name: string
  folder: string
  spriteConfig: Record<PlayerAnim, { frames: number; fps: number }>
}

export const PLAYER_SKINS: Record<PlayerSkin, SkinDef> = {
  default: {
    name: 'Default',
    folder: 'sprites/player',
    spriteConfig: {
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
    },
  },
  pringlan: {
    name: 'Pringlan',
    folder: 'sprites/pringlan',
    spriteConfig: {
      idle:   { frames: 4, fps: 6 },
      run:    { frames: 8, fps: 14 },
      jump:   { frames: 8, fps: 18 },
      land:   { frames: 3, fps: 12 },
      fall:   { frames: 9, fps: 12 },
      dive:   { frames: 5, fps: 10 },
      crouch:   { frames: 3, fps: 20 },
      uncrouch: { frames: 2, fps: 15 },
      roll:   { frames: 2, fps: 8 },
      pickup: { frames: 5, fps: 10 },
    },
  },
}

export const spriteConfig: Record<PlayerAnim, { frames: number; fps: number }> = PLAYER_SKINS.default.spriteConfig

// ─── Enemy Configs ──────────────────────────────────────────────────────────

export const ENEMY_CONFIGS: Record<EnemyBehavior, { hp: number; speed: number; shootInterval: number; bulletSpeed: number; damage: number; pellets: number; spread: number; sightRange: number }> = {
  grunt:      { hp: 60,  speed: 60,  shootInterval: 1.5, bulletSpeed: 500, damage: 8,  pellets: 1, spread: 0,    sightRange: 500 },
  shotgunner: { hp: 80,  speed: 40,  shootInterval: 2.0, bulletSpeed: 400, damage: 6,  pellets: 5, spread: 0.15, sightRange: 350 },
  sniper:     { hp: 40,  speed: 30,  shootInterval: 2.5, bulletSpeed: 800, damage: 20, pellets: 1, spread: 0,    sightRange: 800 },
  rusher:     { hp: 50,  speed: 160, shootInterval: 0.8, bulletSpeed: 450, damage: 6,  pellets: 1, spread: 0.1,  sightRange: 600 },
  boss:       { hp: 500, speed: 50,  shootInterval: 0.6, bulletSpeed: 550, damage: 12, pellets: 3, spread: 0.12, sightRange: 700 },
  drone:      { hp: 25,  speed: 120, shootInterval: 1.2, bulletSpeed: 600, damage: 5,  pellets: 1, spread: 0.05, sightRange: 600 },
}

// ─── Level Layouts ──────────────────────────────────────────────────────────

export interface LevelLayout {
  platforms: Rect[]
  spawnPositions: Vec2[]
}

// Shared walls and ground
const WALLS: Rect[] = [
  { x: 0, y: 0, w: 20, h: 720 },
  { x: 2380, y: 0, w: 20, h: 720 },
]
const GROUND: Rect = { x: 0, y: 620, w: 2400, h: 100 }

export const LEVELS: LevelLayout[] = [
  { // Level 1 — Back Alley: tight ground fight with a few escape routes up
    platforms: [
      GROUND, ...WALLS,
      // Left building ledge — sniper perch
      { x: 40, y: 380, w: 100, h: 20 },
      // Dumpster hop — staircase up the left side
      { x: 180, y: 520, w: 120, h: 20 },
      { x: 260, y: 430, w: 160, h: 20 },
      // Central catwalk
      { x: 500, y: 360, w: 350, h: 20 },
      // Fire escape right side — zigzag
      { x: 950, y: 480, w: 180, h: 20 },
      { x: 1100, y: 380, w: 160, h: 20 },
      { x: 1300, y: 300, w: 200, h: 20 },
      // Right ground platforms — shipping containers
      { x: 1550, y: 540, w: 250, h: 20 },
      { x: 1700, y: 460, w: 200, h: 20 },
      // Far right elevated
      { x: 1950, y: 350, w: 180, h: 20 },
      { x: 2150, y: 480, w: 180, h: 20 },
      // Small hop platforms for mobility
      { x: 700, y: 500, w: 80, h: 20 },
      { x: 420, y: 260, w: 100, h: 20, destructible: true, hp: 50, maxHp: 50 },
    ],
    spawnPositions: [
      { x: 350, y: 570 }, { x: 650, y: 570 }, { x: 1000, y: 570 },
      { x: 1400, y: 570 }, { x: 1800, y: 570 }, { x: 2100, y: 570 },
      { x: 550, y: 310 }, { x: 1150, y: 330 }, { x: 1350, y: 250 },
      { x: 300, y: 380 }, { x: 1750, y: 410 }, { x: 2000, y: 300 },
    ],
  },
  { // Level 2 — Construction Site: vertical, lots of destructible scaffolding
    platforms: [
      GROUND, ...WALLS,
      // Ground-level debris piles
      { x: 150, y: 560, w: 200, h: 60 },
      { x: 1900, y: 560, w: 250, h: 60 },
      // First floor scaffolding
      { x: 80, y: 470, w: 280, h: 20 },
      { x: 450, y: 490, w: 200, h: 20 },
      { x: 750, y: 470, w: 300, h: 20 },
      { x: 1150, y: 490, w: 200, h: 20 },
      { x: 1450, y: 470, w: 250, h: 20 },
      { x: 1800, y: 490, w: 200, h: 20 },
      { x: 2100, y: 470, w: 200, h: 20 },
      // Second floor — destructible wooden planks
      { x: 200, y: 350, w: 250, h: 20, destructible: true, hp: 45, maxHp: 45 },
      { x: 550, y: 360, w: 180, h: 20, destructible: true, hp: 45, maxHp: 45 },
      { x: 850, y: 340, w: 280, h: 20 },
      { x: 1250, y: 360, w: 200, h: 20, destructible: true, hp: 45, maxHp: 45 },
      { x: 1550, y: 340, w: 250, h: 20 },
      { x: 1900, y: 360, w: 180, h: 20, destructible: true, hp: 45, maxHp: 45 },
      // Top floor — steel beams
      { x: 400, y: 220, w: 200, h: 20 },
      { x: 750, y: 200, w: 250, h: 20 },
      { x: 1100, y: 220, w: 300, h: 20 },
      { x: 1600, y: 200, w: 200, h: 20 },
      // Crane arm
      { x: 1900, y: 160, w: 350, h: 20 },
    ],
    spawnPositions: [
      { x: 400, y: 570 }, { x: 800, y: 570 }, { x: 1200, y: 570 },
      { x: 1600, y: 570 }, { x: 200, y: 420 }, { x: 800, y: 420 },
      { x: 1500, y: 420 }, { x: 2150, y: 420 }, { x: 900, y: 290 },
      { x: 1200, y: 170 }, { x: 1650, y: 150 }, { x: 500, y: 170 },
    ],
  },
  { // Level 3 — Subway Station: long horizontal with pits and a central hub
    platforms: [
      // No full ground — gaps create pits
      ...WALLS,
      // Left platform
      { x: 0, y: 620, w: 500, h: 100 },
      // Pit gap (500-700)
      // Central hub platform
      { x: 700, y: 620, w: 900, h: 100 },
      // Pit gap (1600-1800)
      // Right platform
      { x: 1800, y: 620, w: 600, h: 100 },
      // Train tracks at bottom of pits — deadly narrow
      { x: 500, y: 700, w: 200, h: 20 },
      { x: 1600, y: 700, w: 200, h: 20 },
      // Ticket booth platforms — left side
      { x: 60, y: 500, w: 180, h: 20 },
      { x: 300, y: 420, w: 150, h: 20 },
      // Overhead signs / hanging platforms — central
      { x: 800, y: 440, w: 200, h: 20 },
      { x: 1100, y: 400, w: 250, h: 20 },
      { x: 1400, y: 440, w: 180, h: 20 },
      // Bridge over left pit
      { x: 450, y: 520, w: 300, h: 20, destructible: true, hp: 60, maxHp: 60 },
      // Bridge over right pit
      { x: 1600, y: 520, w: 250, h: 20, destructible: true, hp: 60, maxHp: 60 },
      // Upper catwalks
      { x: 200, y: 300, w: 200, h: 20 },
      { x: 600, y: 280, w: 300, h: 20 },
      { x: 1050, y: 260, w: 250, h: 20 },
      { x: 1450, y: 280, w: 200, h: 20 },
      { x: 1800, y: 300, w: 250, h: 20 },
      // Top vantage points
      { x: 500, y: 160, w: 200, h: 20 },
      { x: 1100, y: 140, w: 200, h: 20, destructible: true, hp: 40, maxHp: 40 },
      { x: 1700, y: 160, w: 200, h: 20 },
    ],
    spawnPositions: [
      { x: 200, y: 570 }, { x: 400, y: 570 }, { x: 900, y: 570 },
      { x: 1200, y: 570 }, { x: 1500, y: 570 }, { x: 2000, y: 570 },
      { x: 850, y: 390 }, { x: 1150, y: 350 }, { x: 1450, y: 390 },
      { x: 650, y: 230 }, { x: 1100, y: 210 }, { x: 1850, y: 250 },
    ],
  },
  { // Level 4 — Penthouse: asymmetric, tight left side opens into wide right
    platforms: [
      GROUND, ...WALLS,
      // Left side — tight corridor with low ceiling
      { x: 40, y: 450, w: 350, h: 20 },
      { x: 40, y: 320, w: 250, h: 20 },
      // Elevator shaft — small platforms going up
      { x: 420, y: 530, w: 80, h: 20 },
      { x: 480, y: 430, w: 80, h: 20 },
      { x: 420, y: 330, w: 80, h: 20 },
      { x: 480, y: 230, w: 80, h: 20 },
      // Main penthouse floor
      { x: 600, y: 480, w: 500, h: 20 },
      { x: 1200, y: 480, w: 400, h: 20 },
      // Bar counter
      { x: 700, y: 400, w: 180, h: 20 },
      // Mezzanine / upper lounge
      { x: 950, y: 320, w: 350, h: 20 },
      { x: 1400, y: 350, w: 200, h: 20 },
      // Balcony — far right, open
      { x: 1700, y: 420, w: 300, h: 20 },
      { x: 1800, y: 280, w: 250, h: 20 },
      { x: 2050, y: 500, w: 280, h: 20 },
      // Chandelier — destructible
      { x: 800, y: 200, w: 200, h: 20, destructible: true, hp: 35, maxHp: 35 },
      { x: 1300, y: 180, w: 200, h: 20, destructible: true, hp: 35, maxHp: 35 },
      // Rooftop access
      { x: 1600, y: 160, w: 250, h: 20 },
      { x: 2100, y: 300, w: 200, h: 20 },
    ],
    spawnPositions: [
      { x: 200, y: 570 }, { x: 800, y: 570 }, { x: 1300, y: 570 },
      { x: 1800, y: 570 }, { x: 2200, y: 570 }, { x: 700, y: 430 },
      { x: 1000, y: 270 }, { x: 1450, y: 300 }, { x: 1850, y: 370 },
      { x: 850, y: 150 }, { x: 1350, y: 130 }, { x: 1700, y: 110 },
    ],
  },
  { // Level 5 — Rooftops: wide open, mostly high up, long sightlines for snipers
    platforms: [
      GROUND, ...WALLS,
      // Left rooftop
      { x: 50, y: 400, w: 350, h: 20 },
      { x: 50, y: 400, w: 20, h: 220 }, // wall edge
      // Gap
      // Center rooftop — main arena
      { x: 500, y: 440, w: 600, h: 20 },
      // Water tower
      { x: 650, y: 340, w: 100, h: 20 },
      { x: 670, y: 340, w: 15, h: 100 }, // support
      { x: 765, y: 340, w: 15, h: 100 }, // support
      // AC units as platforms
      { x: 900, y: 380, w: 80, h: 60 },
      // Right buildings — staggered heights
      { x: 1200, y: 480, w: 300, h: 20 },
      { x: 1250, y: 350, w: 200, h: 20 },
      { x: 1600, y: 420, w: 250, h: 20 },
      { x: 1650, y: 300, w: 180, h: 20 },
      // Far right — tall building
      { x: 1950, y: 340, w: 300, h: 20 },
      { x: 2000, y: 200, w: 200, h: 20 },
      // Antenna tower
      { x: 2100, y: 200, w: 15, h: 140 },
      // Bridging planks — destructible
      { x: 380, y: 420, w: 140, h: 20, destructible: true, hp: 40, maxHp: 40 },
      { x: 1100, y: 460, w: 120, h: 20, destructible: true, hp: 40, maxHp: 40 },
      { x: 1500, y: 400, w: 120, h: 20, destructible: true, hp: 40, maxHp: 40 },
      // Low ground connections
      { x: 400, y: 550, w: 150, h: 20 },
      { x: 1100, y: 560, w: 120, h: 20 },
      { x: 1850, y: 540, w: 120, h: 20 },
    ],
    spawnPositions: [
      { x: 150, y: 350 }, { x: 600, y: 390 }, { x: 1000, y: 390 },
      { x: 1300, y: 430 }, { x: 1700, y: 370 }, { x: 2100, y: 290 },
      { x: 700, y: 290 }, { x: 1300, y: 300 }, { x: 1700, y: 250 },
      { x: 2050, y: 150 }, { x: 500, y: 570 }, { x: 1500, y: 570 },
    ],
  },
]

// Legacy exports for compatibility — these get overwritten on level load
export let platforms: Rect[] = LEVELS[0].platforms
export let spawnPositions: Vec2[] = LEVELS[0].spawnPositions

export function setLevel(index: number) {
  const level = LEVELS[index % LEVELS.length]
  platforms = [...level.platforms]
  spawnPositions = level.spawnPositions
}

export function setGeneratedLevel(plats: Rect[], spawns: Vec2[]) {
  platforms = plats
  spawnPositions = spawns
}
