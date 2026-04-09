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

  // Multiplayer
  coopEnabled: false,
  players: [] as any[],
}

export type PlayerState = ReturnType<typeof createPlayerState>

export function createPlayerState(index: number, x = 150, y = 500) {
  return {
    x, y,
    w: 24, h: 44,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    hp: PLAYER_MAX_HP,
    jumpCount: 0,
    doubleJumping: false,
    doubleJumpSpin: 0,
    landingTimer: 0,
    wasAirborne: false,
    jumpHoldTime: 0,
    jumpMaxHold: 0.2,
    jumpWasReleased: true,
    crouching: false,
    uncrouchTimer: 0,
    standingH: 44,
    crouchH: 28,
    rolling: false,
    rollTimer: 0,
    rollDir: 0,
    wallSliding: false,
    wallDir: 0,
    wallJumpCooldown: 0,
    diving: false,
    diveTimer: 0,
    diveDir: 0,
    shootCooldown: 0,
    reloading: false,
    reloadTimer: 0,
    bulletTimeActive: false,
    bulletTimeEnergy: BULLET_TIME_MAX,
    hitFlash: 0,
    pickupTimer: 0,
    // Remote-only animation state
    currentAnim: 'idle' as PlayerAnim,
    animTimer: 0,
    currentWeapon: 'pistol' as WeaponType,
    aimAngle: 0,
    playerIndex: index,
  }
}

export function checkAllPlayersDead() {
  if (state.gameOver) return
  if (state.coopEnabled) {
    // In co-op, only game over if ALL players are dead
    const allDead = state.players.every(p => p.hp <= 0)
    if (!allDead) return
  }
  state.gameOver = true
  state.deathSlowMo = true
  state.deathSlowMoTimer = 2.0
}

export function respawnPlayer() {
  const player = state.player
  player.x = 100; player.y = 500
  player.vx = 0; player.vy = 0
  player.hp = PLAYER_MAX_HP
  player.diving = false; player.diveTimer = 0
  player.crouching = false; player.rolling = false; player.rollTimer = 0
  player.h = player.standingH
  player.jumpCount = 0
  player.doubleJumping = false; player.doubleJumpSpin = 0
  player.jumpHoldTime = 0; player.jumpWasReleased = true
  player.landingTimer = 0; player.wasAirborne = false
  player.wallSliding = false; player.wallDir = 0; player.wallJumpCooldown = 0
  player.bulletTimeEnergy = BULLET_TIME_MAX
  player.bulletTimeActive = false
  player.hitFlash = 0; player.pickupTimer = 0
  player.reloading = false; player.reloadTimer = 0
  player.shootCooldown = 0
  state.currentWeapon = 'pistol'
  state.playerAmmo.pistol = -1
  state.playerAmmo.shotgun = 0
  state.playerAmmo.m16 = 0
  state.playerAmmo.sniper = 0
  state.playerAmmo.grenades = 3
  state.magRounds.pistol = WEAPONS.pistol.magSize
  state.magRounds.shotgun = WEAPONS.shotgun.magSize
  state.magRounds.m16 = WEAPONS.m16.magSize
  state.magRounds.sniper = WEAPONS.sniper.magSize
  state.magRounds.grenades = WEAPONS.grenades.magSize
  state.gameOver = false
  state.deathSlowMo = false
  state.deathSlowMoTimer = 0
  state.bulletTimeToggled = false
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
