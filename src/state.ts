// ─── Game State ──────────────────────────────────────────────────────────────

import type {
  AmmoPickup,
  BloodDecal,
  Bullet,
  CoverBox,
  Enemy,
  FloatingText,
  HealthPickup,
  Particle,
  PlayerAnim,
  ShellCasing,
  Vec2,
  WeaponPickup,
  WeaponType,
} from './types'
import { BULLET_TIME_MAX, PLAYER_MAX_HP, WEAPONS } from './constants'

export const state = {
  // Canvas context (set in main.ts)
  ctx: null as CanvasRenderingContext2D | null,
  armSprite: null as HTMLImageElement | null,

  // Player
  player: {
    x: 100,
    y: 500,
    w: 24,
    h: 44,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    hp: PLAYER_MAX_HP,
    // Jump state
    jumpCount: 0,
    doubleJumping: false,
    doubleJumpSpin: 0,
    landingTimer: 0,
    wasAirborne: false,
    jumpHoldTime: 0,
    jumpMaxHold: 0.2,
    jumpWasReleased: true,
    // Crouch state
    crouching: false,
    uncrouchTimer: 0,
    standingH: 44,
    crouchH: 28,
    // Roll state
    rolling: false,
    rollTimer: 0,
    rollDir: 0,
    // Dive state
    diving: false,
    diveTimer: 0,
    diveDir: 0,
    // Shooting
    shootCooldown: 0,
    reloading: false,
    reloadTimer: 0,
    // Bullet time
    bulletTimeActive: false,
    bulletTimeEnergy: BULLET_TIME_MAX,
    // Animation
    hitFlash: 0,
    pickupTimer: 0,
  },

  // Camera
  camera: { x: 0, y: 0 } as { x: number; y: number },

  // Entity arrays
  bullets: [] as Bullet[],
  particles: [] as Particle[],
  enemies: [] as Enemy[],
  weaponPickups: [] as WeaponPickup[],
  healthPickups: [] as HealthPickup[],
  floatingTexts: [] as FloatingText[],
  shellCasings: [] as ShellCasing[],
  bloodDecals: [] as BloodDecal[],
  ammoPickups: [] as AmmoPickup[],
  coverBoxes: [] as CoverBox[],

  // Scalar state
  timeScale: 1,
  screenShake: 0,
  gameOver: false,
  killCount: 0,
  gameTime: 0,
  comboCount: 0,
  comboTimer: 0,
  hitMarkerTimer: 0,
  baseCameraZoom: 1,
  screenFlash: '' as string,
  screenFlashTimer: 0,
  killCamActive: false,
  killCamTimer: 0,
  deathSlowMo: false,
  deathSlowMoTimer: 0,
  gameState: 'title' as 'title' | 'playing' | 'paused',
  highScore: parseInt(localStorage.getItem('bulletTime2d_highScore') || '0'),

  // Wave system
  wave: 0,
  waveState: 'countdown' as 'active' | 'cleared' | 'countdown',
  waveTimer: 3,
  waveEnemiesAlive: 0,
  totalScore: 0,

  // Animation state
  animTimer: 0,
  animTimerOverride: -1,
  currentAnim: 'idle' as PlayerAnim,

  // Input state
  keys: {} as Record<string, boolean>,
  mouse: { x: 0, y: 0 } as Vec2,
  mouseDown: false,
  mouseClicked: false,
  bulletTimeToggled: false,
  shiftWasUp: true,
  lastLeftTap: 0,
  lastRightTap: 0,
  leftWasUp: true,
  rightWasUp: true,

  // Weapon state
  currentWeapon: 'pistol' as WeaponType,
  playerAmmo: {
    pistol: -1,
    shotgun: 12,
    m16: 90,
    sniper: 10,
  } as Record<WeaponType, number>,
  magRounds: {
    pistol: WEAPONS.pistol.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    m16: WEAPONS.m16.magSize,
    sniper: WEAPONS.sniper.magSize,
  } as Record<WeaponType, number>,
}
