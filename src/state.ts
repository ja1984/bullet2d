// ─── Game State ──────────────────────────────────────────────────────────────

import type {
  AmmoPickup,
  BloodDecal,
  Bullet,
  CoverBox,
  Enemy,
  FloatingText,
  Grenade,
  HealthPickup,
  Helicopter,
  KillFeedEntry,
  Particle,
  Pigeon,
  PlayerAnim,
  Puddle,
  ShellCasing,
  SteamVent,
  Streetlight,
  Vec2,
  WeaponPickup,
  WeaponType,
} from './types'
import { BULLET_TIME_MAX, PLAYER_MAX_HP, WEAPONS } from './constants'
import type { PlayerSkin } from './constants'

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
    // Wall slide/jump state
    wallSliding: false,
    wallDir: 0, // -1 = wall on left, 1 = wall on right
    wallJumpCooldown: 0,
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
  grenades: [] as Grenade[],

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
  highScores: JSON.parse(localStorage.getItem('bulletTime2d_highScores') || '[]') as { score: number; wave: number; kills: number; date: string }[],

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
    shotgun: 0,
    m16: 0,
    sniper: 0,
    grenades: 3,
  } as Record<WeaponType, number>,
  magRounds: {
    pistol: WEAPONS.pistol.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    m16: WEAPONS.m16.magSize,
    sniper: WEAPONS.sniper.magSize,
    grenades: WEAPONS.grenades.magSize,
  } as Record<WeaponType, number>,

  // Kill feed
  killFeed: [] as KillFeedEntry[],
  multiKillCount: 0,
  multiKillTimer: 0,

  // Dual pistol state
  pistolHand: 0 as 0 | 1, // 0 = right, 1 = left

  // Grenade charge
  grenadeCharging: false,
  grenadeChargeTime: 0,

  // Score multiplier
  shotsFired: 0,
  shotsHit: 0,
  scoreMultiplier: 1.0,

  // Weather
  raindrops: [] as { x: number; y: number; speed: number; length: number }[],

  // Dynamic lighting
  lightFlashes: [] as { x: number; y: number; intensity: number; color: string }[],

  // Ambient environment
  steamVents: [] as SteamVent[],
  puddles: [] as Puddle[],
  streetlights: [] as Streetlight[],
  pigeons: [] as Pigeon[],
  helicopters: [] as Helicopter[],

  // Hit pause
  hitPauseTimer: 0,

  // Invincibility
  invincibleTimer: 0,

  // Thunder
  thunderTimer: 10 + Math.random() * 20,
  thunderFlash: 0,

  // Player skin
  playerSkin: (localStorage.getItem('bulletTime2d_skin') || 'default') as PlayerSkin,

  // Reinforcements
  reinforcementsSent: false,
}

export function saveScore() {
  // Update single high score
  if (state.totalScore > state.highScore) {
    state.highScore = state.totalScore
    localStorage.setItem('bulletTime2d_highScore', state.highScore.toString())
  }
  // Add to top 10 leaderboard
  if (state.totalScore > 0) {
    const entry = {
      score: state.totalScore,
      wave: state.wave,
      kills: state.killCount,
      date: new Date().toLocaleDateString(),
    }
    state.highScores.push(entry)
    state.highScores.sort((a, b) => b.score - a.score)
    state.highScores = state.highScores.slice(0, 10)
    localStorage.setItem('bulletTime2d_highScores', JSON.stringify(state.highScores))
  }
}
