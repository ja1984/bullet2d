// ─── Types ───────────────────────────────────────────────────────────────────

interface Vec2 {
  x: number
  y: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  owner: 'player' | 'enemy'
  life: number
  trail: Vec2[]
  damage: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type EnemyBehavior = 'grunt' | 'shotgunner' | 'sniper' | 'rusher' | 'boss'

interface Enemy {
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  vx: number
  vy: number
  onGround: boolean
  facing: number
  shootTimer: number
  alertTimer: number
  state: 'idle' | 'alert' | 'dead'
  deathTimer: number
  patrolDir: number
  patrolTimer: number
  type: string
  behavior: EnemyBehavior
  animTimer: number
  currentAnim: EnemyAnim
  hitTimer: number
  showHpTimer: number
}

interface HealthPickup {
  x: number
  y: number
  vy: number
  onGround: boolean
  life: number
  bobTimer: number
}

interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

interface ShellCasing {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  life: number
}

interface BloodDecal {
  x: number
  y: number
  size: number
  alpha: number
}

interface CoverBox {
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  type: 'crate' | 'barrel' | 'sandbag'
}

interface AmmoPickup {
  x: number
  y: number
  vy: number
  onGround: boolean
  life: number
  bobTimer: number
  weaponType: WeaponType
  amount: number
}

type WeaponType = 'pistol' | 'shotgun' | 'm16' | 'sniper'

interface WeaponDef {
  name: string
  fireRate: number
  bulletSpeed: number
  damage: number
  pellets: number
  spread: number
  shake: number
  color: string
  ammo: number // -1 = infinite
  auto: boolean
  magSize: number
  reloadTime: number
}

interface WeaponPickup {
  x: number
  y: number
  w: number
  h: number
  type: WeaponType
  bobTimer: number
  collected: boolean
}

// ─── Sprite System ───────────────────────────────────────────────────────────

type PlayerAnim = 'idle' | 'run' | 'jump' | 'fall' | 'dive' | 'crouch' | 'uncrouch' | 'roll' | 'pickup' | 'land'

interface SpriteAnim {
  frames: HTMLImageElement[]
  fps: number
  loaded: boolean
}

const playerSprites: Record<PlayerAnim, SpriteAnim> = {} as any

// Sprite config: individual PNGs per frame
// Place in /public/sprites/player/<anim>/<anim>_0.png, <anim>_1.png, etc.
const SPRITE_FRAME_SIZE = 68
const DIVE_SPRITE_Y_OFFSET = 25

const spriteConfig: Record<PlayerAnim, { frames: number; fps: number }> = {
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

let spritesEnabled = false

function loadPlayerSprites() {
  let totalFrames = 0
  let loadedFrames = 0

  for (const config of Object.values(spriteConfig)) {
    totalFrames += config.frames
  }

  for (const [anim, config] of Object.entries(spriteConfig)) {
    const animData: SpriteAnim = {
      frames: [],
      fps: config.fps,
      loaded: false,
    }

    let animLoaded = 0
    for (let i = 0; i < config.frames; i++) {
      const img = new Image()
      img.onload = () => {
        animLoaded++
        loadedFrames++
        if (animLoaded === config.frames) {
          animData.loaded = true
        }
        if (loadedFrames === totalFrames) {
          spritesEnabled = true
          console.log('All player sprites loaded!')
        }
      }
      img.onerror = () => {
        console.warn(`Sprite not found: sprites/player/${anim}/${anim}_${i}.png`)
      }
      img.src = `sprites/player/${anim}/${anim}_${i}.png`
      animData.frames.push(img)
    }

    playerSprites[anim as PlayerAnim] = animData
  }
}

loadPlayerSprites()

let animTimer = 0
let animTimerOverride = -1
let currentAnim: PlayerAnim = 'idle'

function getPlayerAnim(): PlayerAnim {
  if (player.rolling) return 'roll'
  if (player.diving) return 'dive'
  if (player.doubleJumping) return 'roll'
  if (player.crouching) return 'crouch'
  if (player.uncrouchTimer > 0 && player.onGround) return 'uncrouch'
  if (!player.onGround) return 'jump'
  if (player.landingTimer > 0) return 'land'
  if (Math.abs(player.vx) > 5) return 'run'
  return 'idle'
}

function drawSprite(anim: SpriteAnim, x: number, y: number, flipX: boolean, rotation = 0, loop = true, anchorBottom = false, forceFrame = -1) {
  if (!anim.loaded) return false

  const rawFrame = Math.floor(animTimer * anim.fps)
  const frameIdx = forceFrame >= 0 ? forceFrame : (loop ? rawFrame % anim.frames.length : Math.min(rawFrame, anim.frames.length - 1))
  const img = anim.frames[frameIdx]
  const drawW = SPRITE_FRAME_SIZE
  const drawH = SPRITE_FRAME_SIZE

  const centerX = x + player.w / 2
  const diveOffset = (anchorBottom && frameIdx >= 2) ? DIVE_SPRITE_Y_OFFSET : 0
  const centerY = anchorBottom
    ? (y + player.h) - drawH / 2 + diveOffset
    : y + player.h / 2

  ctx.save()
  ctx.translate(centerX, centerY)
  if (rotation) ctx.rotate(rotation)
  if (flipX) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
  return true
}

// ─── Enemy Sprite System ─────────────────────────────────────────────────────

type EnemyAnim = 'idle' | 'walk' | 'hit' | 'death'

const ENEMY_SPRITE_FRAME_SIZE = 68

interface EnemyTypeDef {
  sprites: Record<EnemyAnim, SpriteAnim>
  spriteConfig: Record<EnemyAnim, { frames: number; fps: number }>
}

const enemyTypes: Record<string, EnemyTypeDef> = {}

function loadEnemySprites(typeName: string, config: Record<EnemyAnim, { frames: number; fps: number }>) {
  const def: EnemyTypeDef = {
    sprites: {} as any,
    spriteConfig: config,
  }

  for (const [anim, cfg] of Object.entries(config)) {
    const animData: SpriteAnim = {
      frames: [],
      fps: cfg.fps,
      loaded: false,
    }

    let animLoaded = 0
    for (let i = 0; i < cfg.frames; i++) {
      const img = new Image()
      img.onload = () => {
        animLoaded++
        if (animLoaded === cfg.frames) {
          animData.loaded = true
          console.log(`Enemy ${typeName}/${anim} sprites loaded!`)
        }
      }
      img.onerror = () => {
        console.warn(`Sprite not found: sprites/enemies/${typeName}/${anim}/${anim}_${i}.png`)
      }
      img.src = `sprites/enemies/${typeName}/${anim}/${anim}_${i}.png`
      animData.frames.push(img)
    }

    def.sprites[anim as EnemyAnim] = animData
  }

  enemyTypes[typeName] = def
}

// Load grunt enemy type — update frame counts to match your assets
loadEnemySprites('grunt', {
  idle: { frames: 4, fps: 6 },
  walk: { frames: 6, fps: 10 },
  hit:   { frames: 9, fps: 14 },
  death: { frames: 10, fps: 10 },
})

function getEnemyAnim(e: Enemy): EnemyAnim {
  if (e.state === 'dead') return 'death'
  if (e.hitTimer > 0) return 'hit'
  if (e.state === 'idle' && Math.abs(e.vx) > 10) return 'walk'
  return 'idle'
}

function drawEnemySprite(e: Enemy): boolean {
  const typeDef = enemyTypes[e.type]
  if (!typeDef) return false

  const anim = getEnemyAnim(e)
  if (anim !== e.currentAnim) {
    e.currentAnim = anim
    e.animTimer = 0
  }

  const sheet = typeDef.sprites[anim]
  if (!sheet?.loaded) return false

  const shouldLoop = anim !== 'hit' && anim !== 'death'
  const rawFrame = Math.floor(e.animTimer * sheet.fps)
  const frameIdx = shouldLoop ? rawFrame % sheet.frames.length : Math.min(rawFrame, sheet.frames.length - 1)
  const img = sheet.frames[frameIdx]

  const flipX = e.facing < 0
  const centerX = e.x + e.w / 2
  const centerY = e.y + e.h / 2

  ctx.save()
  ctx.translate(centerX, centerY)
  if (flipX) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -ENEMY_SPRITE_FRAME_SIZE / 2, -ENEMY_SPRITE_FRAME_SIZE / 2, ENEMY_SPRITE_FRAME_SIZE, ENEMY_SPRITE_FRAME_SIZE)
  ctx.restore()
  return true
}

// ─── Weapon Sprites ──────────────────────────────────────────────────────────

interface WeaponSprite {
  image: HTMLImageElement
  w: number
  h: number
  loaded: boolean
}

const weaponSprites: Record<WeaponType, WeaponSprite> = {} as any

function loadWeaponSprites() {
  const weapons: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper']
  for (const name of weapons) {
    const sprite: WeaponSprite = {
      image: new Image(),
      w: 0, h: 0,
      loaded: false,
    }
    sprite.image.onload = () => {
      sprite.w = sprite.image.width
      sprite.h = sprite.image.height
      sprite.loaded = true
      console.log(`Weapon sprite loaded: ${name} (${sprite.w}x${sprite.h})`)
    }
    sprite.image.onerror = () => {
      console.warn(`Weapon sprite not found: sprites/weapons/${name}.png`)
    }
    sprite.image.src = `sprites/weapons/${name}.png`
    weaponSprites[name] = sprite
  }
}

loadWeaponSprites()

// ─── Audio System ────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playNoise(duration: number, volume: number, filterFreq: number) {
  const ctx = getAudio()
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}

function playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'square', decay = true) {
  const ctx = getAudio()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

const SFX = {
  pistolShot() {
    playNoise(0.08, 0.3, 3000)
    playTone(800, 0.05, 0.15, 'square')
  },
  shotgunShot() {
    playNoise(0.15, 0.5, 2000)
    playTone(200, 0.1, 0.2, 'sawtooth')
    playTone(120, 0.12, 0.15, 'square')
  },
  m16Shot() {
    playNoise(0.05, 0.25, 4000)
    playTone(1200, 0.03, 0.1, 'square')
  },
  sniperShot() {
    playNoise(0.2, 0.6, 1500)
    playTone(150, 0.15, 0.3, 'sawtooth')
    playTone(80, 0.2, 0.2, 'square')
  },
  bulletImpact() {
    playNoise(0.04, 0.15, 2500)
    playTone(400, 0.03, 0.08, 'square')
  },
  headshot() {
    playNoise(0.06, 0.3, 3500)
    playTone(1500, 0.08, 0.2, 'square')
    playTone(2000, 0.06, 0.15, 'sine')
  },
  reload() {
    const ctx = getAudio()
    // Click
    setTimeout(() => playTone(1800, 0.02, 0.15, 'square'), 0)
    // Clack
    setTimeout(() => {
      if (ctx.state === 'running') playTone(1200, 0.03, 0.15, 'square')
    }, 100)
  },
  bulletTimeOn() {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    playNoise(0.3, 0.1, 500)
  },
  bulletTimeOff() {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  },
  enemyDeath() {
    playNoise(0.1, 0.2, 1500)
    playTone(300, 0.08, 0.12, 'sawtooth')
    playTone(150, 0.12, 0.1, 'square')
  },
  playerHit() {
    playNoise(0.08, 0.3, 1800)
    playTone(200, 0.1, 0.2, 'square')
  },
  waveCleared() {
    const ctx = getAudio()
    // Little victory jingle — 3 ascending tones
    ;[523, 659, 784].forEach((freq, i) => {
      setTimeout(() => {
        if (ctx.state === 'running') {
          playTone(freq, 0.2, 0.15, 'square')
          playTone(freq * 2, 0.15, 0.08, 'sine')
        }
      }, i * 120)
    })
  },
  explosion() {
    playNoise(0.25, 0.5, 1200)
    playTone(60, 0.2, 0.3, 'sawtooth')
    playTone(40, 0.25, 0.2, 'square')
  },
  shellCasing() {
    playTone(4000 + Math.random() * 2000, 0.015, 0.04, 'sine')
  },
  pickup() {
    playTone(800, 0.08, 0.12, 'sine')
    setTimeout(() => playTone(1200, 0.08, 0.1, 'sine'), 60)
  },
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 1280
const CANVAS_H = 720
const GRAVITY = 1800
const PLAYER_SPEED = 280
const PLAYER_JUMP = 460
const DIVE_SPEED = 500
const DIVE_DURATION = 0.5
const BULLET_LIFE = 2
const BULLET_TIME_SCALE = 0.2
const BULLET_TIME_MAX = 10
const BULLET_TIME_RECHARGE = 0.8
const ENEMY_SHOOT_INTERVAL = 1.5
const ENEMY_BULLET_SPEED = 500
const ENEMY_SIGHT_RANGE = 500
const PLAYER_MAX_HP = 100
const DOUBLE_TAP_WINDOW = 0.25

// ─── Weapon Definitions ─────────────────────────────────────────────────────

const WEAPONS: Record<WeaponType, WeaponDef> = {
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

// ─── Canvas Setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = CANVAS_W
canvas.height = CANVAS_H

// ─── Input ───────────────────────────────────────────────────────────────────

const keys: Record<string, boolean> = {}
const mouse: Vec2 = { x: 0, y: 0 }
let mouseDown = false
let mouseClicked = false
let bulletTimeToggled = false
let shiftWasUp = true

// Double-tap tracking
let lastLeftTap = 0
let lastRightTap = 0
let leftWasUp = true
let rightWasUp = true

window.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()
  if (e.code === 'Escape' && gameState === 'playing') {
    gameState = 'paused'
  } else if (e.code === 'Escape' && gameState === 'paused') {
    gameState = 'playing'
  }
})
window.addEventListener('keyup', (e) => { keys[e.code] = false })
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouse.x = (e.clientX - rect.left) * (CANVAS_W / rect.width)
  mouse.y = (e.clientY - rect.top) * (CANVAS_H / rect.height)
})
canvas.addEventListener('mousedown', () => {
  mouseDown = true; mouseClicked = true
  if (gameState === 'title') { gameState = 'playing' }
})
canvas.addEventListener('mouseup', () => { mouseDown = false })

// Weapon switching with number keys and scroll
window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') switchWeapon('pistol')
  if (e.code === 'Digit2' && playerAmmo.shotgun > 0) switchWeapon('shotgun')
  if (e.code === 'Digit3' && playerAmmo.m16 > 0) switchWeapon('m16')
  if (e.code === 'Digit4' && playerAmmo.sniper > 0) switchWeapon('sniper')
})
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const available = getAvailableWeapons()
  if (available.length <= 1) return
  const idx = available.indexOf(currentWeapon)
  const next = e.deltaY > 0
    ? available[(idx + 1) % available.length]
    : available[(idx - 1 + available.length) % available.length]
  switchWeapon(next)
}, { passive: false })

// ─── Level ───────────────────────────────────────────────────────────────────

const platforms: Rect[] = [
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

// ─── Game State ──────────────────────────────────────────────────────────────

let currentWeapon: WeaponType = 'pistol'
const playerAmmo: Record<WeaponType, number> = {
  pistol: -1,
  shotgun: 12,
  m16: 90,
  sniper: 10,
}
const magRounds: Record<WeaponType, number> = {
  pistol: WEAPONS.pistol.magSize,
  shotgun: WEAPONS.shotgun.magSize,
  m16: WEAPONS.m16.magSize,
  sniper: WEAPONS.sniper.magSize,
}

function getAvailableWeapons(): WeaponType[] {
  const all: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper']
  return all.filter(w => playerAmmo[w] === -1 || playerAmmo[w] > 0)
}

function switchWeapon(w: WeaponType) {
  if (w === currentWeapon) return
  if (playerAmmo[w] === 0) return
  currentWeapon = w
  player.reloading = false
  player.reloadTimer = 0
}

const player = {
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
}

const camera = { x: 0, y: 0 }
const bullets: Bullet[] = []
const particles: Particle[] = []
const enemies: Enemy[] = []
const weaponPickups: WeaponPickup[] = []

let timeScale = 1
let screenShake = 0
let gameOver = false
let killCount = 0
let gameTime = 0

// New systems
const healthPickups: HealthPickup[] = []
const floatingTexts: FloatingText[] = []
const shellCasings: ShellCasing[] = []
const bloodDecals: BloodDecal[] = []
const ammoPickups: AmmoPickup[] = []
const coverBoxes: CoverBox[] = []
let comboCount = 0
let comboTimer = 0
const COMBO_WINDOW = 2.0
let hitMarkerTimer = 0
let baseCameraZoom = 1
let screenFlash = '' // color string, empty = none
let screenFlashTimer = 0
let killCamActive = false
let killCamTimer = 0
let deathSlowMo = false
let deathSlowMoTimer = 0
let gameState: 'title' | 'playing' | 'paused' = 'title'
let highScore = parseInt(localStorage.getItem('bulletTime2d_highScore') || '0')

// Wave system
let wave = 0
let waveState: 'active' | 'cleared' | 'countdown' = 'countdown'
let waveTimer = 3
let waveEnemiesAlive = 0
let totalScore = 0

// Enemy type configs
const ENEMY_CONFIGS: Record<EnemyBehavior, { hp: number; speed: number; shootInterval: number; bulletSpeed: number; damage: number; pellets: number; spread: number; sightRange: number }> = {
  grunt:      { hp: 60,  speed: 60,  shootInterval: 1.5, bulletSpeed: 500, damage: 8,  pellets: 1, spread: 0,    sightRange: 500 },
  shotgunner: { hp: 80,  speed: 40,  shootInterval: 2.0, bulletSpeed: 400, damage: 6,  pellets: 5, spread: 0.15, sightRange: 350 },
  sniper:     { hp: 40,  speed: 30,  shootInterval: 2.5, bulletSpeed: 800, damage: 20, pellets: 1, spread: 0,    sightRange: 800 },
  rusher:     { hp: 50,  speed: 160, shootInterval: 0.8, bulletSpeed: 450, damage: 6,  pellets: 1, spread: 0.1,  sightRange: 600 },
  boss:       { hp: 500, speed: 50,  shootInterval: 0.6, bulletSpeed: 550, damage: 12, pellets: 3, spread: 0.12, sightRange: 700 },
}

const spawnPositions: Vec2[] = [
  { x: 450, y: 570 }, { x: 700, y: 570 }, { x: 550, y: 370 },
  { x: 900, y: 300 }, { x: 1150, y: 420 }, { x: 1450, y: 330 },
  { x: 1750, y: 250 }, { x: 1550, y: 480 }, { x: 1900, y: 570 },
  { x: 2100, y: 570 }, { x: 300, y: 250 }, { x: 100, y: 570 },
]

function spawnEnemy(x: number, y: number, behavior: EnemyBehavior) {
  const cfg = ENEMY_CONFIGS[behavior]
  const diff = getDifficultyMult()
  const scaledHp = Math.round(cfg.hp * diff)
  enemies.push({
    x, y, w: behavior === 'boss' ? 36 : 24, h: behavior === 'boss' ? 56 : 44,
    hp: scaledHp, maxHp: scaledHp,
    vx: 0, vy: 0,
    onGround: false,
    facing: -1,
    shootTimer: Math.random() * cfg.shootInterval,
    alertTimer: 0,
    state: 'idle',
    deathTimer: 0,
    patrolDir: Math.random() > 0.5 ? 1 : -1,
    patrolTimer: Math.random() * 3 + 1,
    type: 'grunt', // sprite type — all use grunt sprites for now
    behavior,
    animTimer: 0,
    currentAnim: 'idle',
    hitTimer: 0,
    showHpTimer: 0,
  })
}

// Difficulty multiplier — enemies get tougher each wave
function getDifficultyMult(): number {
  return 1 + (wave - 1) * 0.1 // +10% per wave
}

function getWaveEnemies(waveNum: number): { behavior: EnemyBehavior; count: number }[] {
  // Boss wave every 5
  if (waveNum % 5 === 0) {
    return [
      { behavior: 'boss', count: 1 },
      { behavior: 'grunt', count: Math.floor(waveNum / 2) },
    ]
  }
  if (waveNum <= 1) return [{ behavior: 'grunt', count: 4 }]
  if (waveNum === 2) return [{ behavior: 'grunt', count: 5 }, { behavior: 'shotgunner', count: 1 }]
  if (waveNum === 3) return [{ behavior: 'grunt', count: 4 }, { behavior: 'shotgunner', count: 2 }, { behavior: 'sniper', count: 1 }]
  if (waveNum === 4) return [{ behavior: 'grunt', count: 3 }, { behavior: 'rusher', count: 3 }, { behavior: 'sniper', count: 1 }]
  // Wave 6+ scales up
  const base = waveNum - 3
  return [
    { behavior: 'grunt', count: 2 + base },
    { behavior: 'shotgunner', count: 1 + Math.floor(base / 2) },
    { behavior: 'sniper', count: 1 + Math.floor(base / 3) },
    { behavior: 'rusher', count: 1 + Math.floor(base / 2) },
  ]
}

function startWave() {
  wave++
  waveState = 'active'
  const waveEnemies = getWaveEnemies(wave)
  let spawnIdx = 0
  for (const group of waveEnemies) {
    for (let i = 0; i < group.count; i++) {
      const pos = spawnPositions[spawnIdx % spawnPositions.length]
      spawnEnemy(pos.x, pos.y, group.behavior)
      spawnIdx++
    }
  }
  waveEnemiesAlive = enemies.filter(e => e.state !== 'dead').length
}

function spawnEnemies() {
  // Legacy compat — just start wave 1
  startWave()
}

function spawnCoverBoxes() {
  coverBoxes.length = 0
  const boxTypes: CoverBox['type'][] = ['crate', 'barrel', 'sandbag']
  // Spawn on ground and on platforms
  const groundY = 620
  const groundSpots = [300, 550, 800, 1050, 1300, 1600, 1850, 2050]
  for (const gx of groundSpots) {
    if (Math.random() < 0.6) {
      const t = boxTypes[Math.floor(Math.random() * boxTypes.length)]
      const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
      const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
      coverBoxes.push({
        x: gx + (Math.random() - 0.5) * 60,
        y: groundY - h,
        w, h,
        hp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        maxHp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        type: t,
      })
    }
  }
  // A few on platforms
  const platSpots = [
    { x: 280, y: 500 }, { x: 600, y: 420 }, { x: 920, y: 350 },
    { x: 1150, y: 470 }, { x: 1500, y: 380 },
  ]
  for (const ps of platSpots) {
    if (Math.random() < 0.4) {
      const t = boxTypes[Math.floor(Math.random() * boxTypes.length)]
      const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
      const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
      coverBoxes.push({
        x: ps.x, y: ps.y - h - 20, w, h,
        hp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        maxHp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        type: t,
      })
    }
  }
}

function spawnWeaponPickups() {
  const pickupSpots: { pos: Vec2; type: WeaponType }[] = [
    { pos: { x: 550, y: 390 }, type: 'shotgun' },
    { pos: { x: 900, y: 320 }, type: 'm16' },
    { pos: { x: 1450, y: 350 }, type: 'shotgun' },
    { pos: { x: 1750, y: 270 }, type: 'shotgun' },
    { pos: { x: 350, y: 270 }, type: 'm16' },
    { pos: { x: 1550, y: 500 }, type: 'shotgun' },
    { pos: { x: 1100, y: 440 }, type: 'm16' },
  ]
  for (const spot of pickupSpots) {
    weaponPickups.push({
      x: spot.pos.x, y: spot.pos.y,
      w: 20, h: 14,
      type: spot.type,
      bobTimer: Math.random() * Math.PI * 2,
      collected: false,
    })
  }
}

spawnWeaponPickups()
spawnCoverBoxes()

// ─── Collision ───────────────────────────────────────────────────────────────

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function resolvePhysics(
  entity: { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean },
  dt: number
) {
  entity.vy += GRAVITY * dt
  entity.x += entity.vx * dt
  entity.y += entity.vy * dt
  entity.onGround = false

  for (const p of platforms) {
    if (!rectsOverlap(entity, p)) continue

    const overlapLeft = (entity.x + entity.w) - p.x
    const overlapRight = (p.x + p.w) - entity.x
    const overlapTop = (entity.y + entity.h) - p.y
    const overlapBottom = (p.y + p.h) - entity.y

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

    if (minOverlap === overlapTop && entity.vy >= 0) {
      entity.y = p.y - entity.h
      entity.vy = 0
      entity.onGround = true
    } else if (minOverlap === overlapBottom && entity.vy < 0) {
      entity.y = p.y + p.h
      entity.vy = 0
    } else if (minOverlap === overlapLeft) {
      entity.x = p.x - entity.w
      entity.vx = 0
    } else if (minOverlap === overlapRight) {
      entity.x = p.x + p.w
      entity.vx = 0
    }
  }

  // Cover box collision
  for (const box of coverBoxes) {
    if (!rectsOverlap(entity, box)) continue

    const overlapLeft = (entity.x + entity.w) - box.x
    const overlapRight = (box.x + box.w) - entity.x
    const overlapTop = (entity.y + entity.h) - box.y
    const overlapBottom = (box.y + box.h) - entity.y

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

    if (minOverlap === overlapTop && entity.vy >= 0) {
      entity.y = box.y - entity.h
      entity.vy = 0
      entity.onGround = true
    } else if (minOverlap === overlapBottom && entity.vy < 0) {
      entity.y = box.y + box.h
      entity.vy = 0
    } else if (minOverlap === overlapLeft) {
      entity.x = box.x - entity.w
      entity.vx = 0
    } else if (minOverlap === overlapRight) {
      entity.x = box.x + box.w
      entity.vx = 0
    }
  }
}

// ─── Particles ───────────────────────────────────────────────────────────────

function spawnParticles(x: number, y: number, count: number, color: string, speed = 200) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const spd = Math.random() * speed
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 50,
      life: 0.3 + Math.random() * 0.5,
      maxLife: 0.3 + Math.random() * 0.5,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

function spawnMuzzleFlash(x: number, y: number, angle: number) {
  for (let i = 0; i < 5; i++) {
    const spread = (Math.random() - 0.5) * 0.5
    const spd = 100 + Math.random() * 150
    particles.push({
      x, y,
      vx: Math.cos(angle + spread) * spd,
      vy: Math.sin(angle + spread) * spd,
      life: 0.1 + Math.random() * 0.1,
      maxLife: 0.15,
      color: '#ffa',
      size: 3 + Math.random() * 3,
    })
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

function update(dt: number) {
  gameTime += dt

  if (gameOver) {
    if (deathSlowMo) {
      deathSlowMoTimer -= dt
      if (deathSlowMoTimer <= 0) deathSlowMo = false
      // Still update particles during death slow-mo
      const ddt = dt * 0.3
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * ddt; p.y += p.vy * ddt; p.vy += 400 * ddt; p.life -= ddt
        if (p.life <= 0) particles.splice(i, 1)
      }
    }
    if (keys['KeyR']) restart()
    return
  }

  // Bullet time (toggle on Shift press)
  const shiftDown = keys['ShiftRight'] || keys['ShiftLeft']
  if (shiftDown && shiftWasUp) {
    bulletTimeToggled = !bulletTimeToggled
    if (bulletTimeToggled) SFX.bulletTimeOn()
    else SFX.bulletTimeOff()
  }
  shiftWasUp = !shiftDown

  if (bulletTimeToggled && player.bulletTimeEnergy > 0) {
    player.bulletTimeActive = true
    // player.bulletTimeEnergy -= dt // DEBUG: infinite bullet time
    if (player.bulletTimeEnergy <= 0) {
      player.bulletTimeEnergy = 0
      player.bulletTimeActive = false
      bulletTimeToggled = false
    }
  } else {
    player.bulletTimeActive = false
    bulletTimeToggled = false
    player.bulletTimeEnergy = Math.min(BULLET_TIME_MAX, player.bulletTimeEnergy + BULLET_TIME_RECHARGE * dt)
  }

  timeScale = (player.bulletTimeActive || killCamActive) ? BULLET_TIME_SCALE : (deathSlowMo ? 0.3 : 1)
  const gameDt = dt * timeScale

  // Player animation timer
  const newAnim = getPlayerAnim()
  if (newAnim !== currentAnim) {
    currentAnim = newAnim
    if (animTimerOverride < 0) animTimer = 0
    else { animTimer = animTimerOverride; animTimerOverride = -1 }
  }
  animTimer += gameDt

  // Screen shake decay
  screenShake *= 0.9

  // Player hit flash
  if (player.hitFlash > 0) player.hitFlash -= dt
  if (player.pickupTimer > 0) {
    player.pickupTimer -= dt
    if (player.pickupTimer <= 0) {
      player.h = player.standingH
    }
  }

  // ── Player Movement ──
  const aimWorldX = mouse.x + camera.x
  const aimWorldY = mouse.y + camera.y
  player.facing = aimWorldX > player.x + player.w / 2 ? 1 : -1

  // Double-tap detection
  const leftDown = keys['KeyA'] || keys['ArrowLeft']
  const rightDown = keys['KeyD'] || keys['ArrowRight']
  let doubleTapLeft = false
  let doubleTapRight = false

  if (leftDown && leftWasUp) {
    const now = gameTime
    if (now - lastLeftTap < DOUBLE_TAP_WINDOW) {
      doubleTapLeft = true
    }
    lastLeftTap = now
  }
  leftWasUp = !leftDown

  if (rightDown && rightWasUp) {
    const now = gameTime
    if (now - lastRightTap < DOUBLE_TAP_WINDOW) {
      doubleTapRight = true
    }
    lastRightTap = now
  }
  rightWasUp = !rightDown

  // Crouch
  const wantsCrouch = (keys['KeyS'] || keys['ArrowDown']) && player.onGround && !player.diving
  if (wantsCrouch && !player.crouching) {
    player.crouching = true
    player.uncrouchTimer = 0
    player.y += player.standingH - player.crouchH
    player.h = player.crouchH
  } else if (!wantsCrouch && player.crouching) {
    player.crouching = false
    player.uncrouchTimer = spriteConfig.uncrouch.frames / spriteConfig.uncrouch.fps
    player.y -= player.standingH - player.crouchH
    player.h = player.standingH
  }
  if (player.uncrouchTimer > 0) player.uncrouchTimer -= dt

  if (!player.diving) {
    player.vx = 0
    const moveSpeed = player.crouching ? PLAYER_SPEED * 0.4 : PLAYER_SPEED
    if (leftDown) player.vx = -moveSpeed
    if (rightDown) player.vx = moveSpeed

    const jumpPressed = keys['KeyW'] || keys['ArrowUp'] || keys['Space']

    if (player.onGround) {
      // Trigger landing animation only if we were airborne from a jump
      if (player.wasAirborne && player.landingTimer <= 0 && !player.diving) {
        player.landingTimer = spriteConfig.land.frames / spriteConfig.land.fps
      }
      player.wasAirborne = false
      player.jumpCount = 0
      player.doubleJumping = false
      player.doubleJumpSpin = 0
      player.jumpHoldTime = 0
      if (!jumpPressed) player.jumpWasReleased = true
    }
    if (player.landingTimer > 0) player.landingTimer -= dt
    if (player.doubleJumping) {
      player.doubleJumpSpin += dt * player.facing * Math.PI * 4
    }

    if (!jumpPressed) {
      player.jumpWasReleased = true
      // Cut jump short when releasing early
      if (player.vy < 0 && player.jumpHoldTime > 0) {
        player.vy *= 0.5
        player.jumpHoldTime = 0
      }
      // End double jump spin on release (only once)
      if (player.doubleJumping) {
        player.doubleJumping = false
        player.doubleJumpSpin = 0
        animTimerOverride = 2 / spriteConfig.jump.fps
      }
    }

    // Start a new jump on fresh press
    if (jumpPressed && player.jumpWasReleased && player.jumpCount < 2) {
      if (player.onGround || player.jumpCount === 1) {
        const jumpForce = player.jumpCount === 0 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
        player.vy = jumpForce * 0.6 // initial burst (short jump minimum)
        player.jumpHoldTime = gameDt
        if (player.jumpCount === 1) {
          player.doubleJumping = true
          player.doubleJumpSpin = 0
        }
        player.jumpCount++
        player.wasAirborne = true
        player.jumpWasReleased = false
      }
    }

    // Variable jump height — keep adding force while holding
    if (jumpPressed && !player.jumpWasReleased && player.jumpHoldTime > 0 && player.jumpHoldTime < player.jumpMaxHold) {
      player.jumpHoldTime += gameDt
      const jumpForce = player.jumpCount === 1 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
      player.vy = jumpForce * (0.6 + 0.4 * (player.jumpHoldTime / player.jumpMaxHold))
    }
    const shouldDive = doubleTapLeft || doubleTapRight
    if (shouldDive && !player.rolling) {
      const diveDirection = doubleTapRight ? 1 : -1
      if (player.crouching) {
        // Action roll — stay low, fast ground movement
        player.rolling = true
        player.rollTimer = 0.4
        player.rollDir = diveDirection
        player.vx = DIVE_SPEED * 1.2 * diveDirection
        player.vy = 0
      } else {
        player.diving = true
        player.diveTimer = DIVE_DURATION
        player.diveDir = diveDirection
        player.vx = DIVE_SPEED * diveDirection
        player.vy = player.onGround ? -120 : -80
      }
    }
  } else {
    player.diveTimer -= gameDt
    if (player.diveTimer <= 0) {
      player.diving = false
    } else if (player.onGround) {
      player.vx = player.diveDir * DIVE_SPEED * 0.5
    }
  }

  // Roll update
  if (player.rolling) {
    player.rollTimer -= gameDt
    player.vx = DIVE_SPEED * 1.2 * player.rollDir * (player.rollTimer / 0.4)
    if (player.rollTimer <= 0) {
      player.rolling = false
    }
  }

  resolvePhysics(player, gameDt)

  // ── Weapon Pickups ──
  for (const wp of weaponPickups) {
    if (wp.collected) continue
    wp.bobTimer += dt * 3
    const pr: Rect = { x: player.x, y: player.y, w: player.w, h: player.h }
    const wr: Rect = { x: wp.x, y: wp.y - Math.sin(wp.bobTimer) * 4, w: wp.w, h: wp.h }
    if (rectsOverlap(pr, wr)) {
      wp.collected = true
      const wpDef = WEAPONS[wp.type]
      playerAmmo[wp.type] += wpDef.ammo
      currentWeapon = wp.type
      floatingTexts.push({
        x: player.x + player.w / 2, y: player.y - 15,
        text: `+${wpDef.name}`, color: wpDef.color,
        life: 1.0, maxLife: 1.0,
      })
      SFX.pickup()
    }
  }

  // ── Shooting ──
  const weapon = WEAPONS[currentWeapon]
  player.shootCooldown -= dt

  // Reload logic
  if (player.reloading) {
    player.reloadTimer -= dt
    if (player.reloadTimer <= 0) {
      player.reloading = false
      magRounds[currentWeapon] = weapon.magSize
    }
  }

  // Manual reload with R
  if (keys['KeyR'] && !player.reloading && magRounds[currentWeapon] < weapon.magSize) {
    player.reloading = true
    player.reloadTimer = weapon.reloadTime
    SFX.reload()
    keys['KeyR'] = false
  }

  const canShoot = weapon.auto ? mouseDown : mouseClicked
  mouseClicked = false
  if (canShoot && player.shootCooldown <= 0 && !player.reloading) {
    // Check mag
    if (magRounds[currentWeapon] <= 0) {
      // Auto reload when mag empty
      player.reloading = true
      player.reloadTimer = weapon.reloadTime
      return
    }
    magRounds[currentWeapon]--

    player.shootCooldown = weapon.fireRate
    const cx = player.x + player.w / 2
    const cy = player.y + player.h / 2 - 4
    const baseAngle = Math.atan2(aimWorldY - cy, aimWorldX - cx)
    const ws = weaponSprites[currentWeapon]
    const targetH = 12
    const gunDist = ws?.loaded ? ws.w * (targetH / ws.h) : 18

    for (let p = 0; p < weapon.pellets; p++) {
      const spreadAngle = baseAngle + (Math.random() - 0.5) * weapon.spread * 2
      const bx = cx + Math.cos(baseAngle) * gunDist
      const by = cy + Math.sin(baseAngle) * gunDist

      bullets.push({
        x: bx, y: by,
        vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
        vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
        owner: 'player',
        life: BULLET_LIFE,
        trail: [],
        damage: weapon.damage,
      })
    }
    spawnMuzzleFlash(cx + Math.cos(baseAngle) * gunDist, cy + Math.sin(baseAngle) * gunDist, baseAngle)
    // Shell casing
    SFX.shellCasing()
    const shellAngle = baseAngle + (player.facing > 0 ? -Math.PI / 2 : Math.PI / 2)
    shellCasings.push({
      x: cx, y: cy,
      vx: Math.cos(shellAngle) * (60 + Math.random() * 40),
      vy: -80 - Math.random() * 60,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 20,
      life: 1.5,
    })
    screenShake = weapon.shake
    // Recoil — push player opposite to aim (only affects camera, not movement)
    camera.x -= Math.cos(baseAngle) * weapon.shake * 1.5
    camera.y -= Math.sin(baseAngle) * weapon.shake * 1.5
    // Weapon sound
    if (currentWeapon === 'pistol') SFX.pistolShot()
    else if (currentWeapon === 'shotgun') SFX.shotgunShot()
    else if (currentWeapon === 'm16') SFX.m16Shot()
    else if (currentWeapon === 'sniper') SFX.sniperShot()
  }

  // ── Enemies ──
  for (const e of enemies) {
    e.animTimer += gameDt
    if (e.hitTimer > 0) e.hitTimer -= gameDt

    if (e.state === 'dead') {
      e.deathTimer -= gameDt
      resolvePhysics(e, gameDt)
      continue
    }

    const cfg = ENEMY_CONFIGS[e.behavior]
    if (e.showHpTimer > 0) e.showHpTimer -= gameDt

    // Check if player is in sight
    const dx = player.x - e.x
    const dy = player.y - e.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < cfg.sightRange) {
      e.state = 'alert'
      e.alertTimer = 3
      e.facing = dx > 0 ? 1 : -1
    } else if (e.state === 'alert') {
      e.alertTimer -= gameDt
      if (e.alertTimer <= 0) e.state = 'idle'
    }

    if (e.state === 'idle') {
      e.patrolTimer -= gameDt
      if (e.patrolTimer <= 0) {
        e.patrolDir *= -1
        e.patrolTimer = 2 + Math.random() * 3
      }
      e.vx = e.patrolDir * cfg.speed
      e.facing = e.patrolDir
    } else if (e.state === 'alert') {
      // Behavior-specific alert logic
      if (e.behavior === 'rusher') {
        // Rush toward player
        e.vx = (dx > 0 ? 1 : -1) * cfg.speed
      } else if (e.behavior === 'sniper') {
        // Keep distance — back away if too close
        if (dist < 300) {
          e.vx = (dx > 0 ? -1 : 1) * cfg.speed
        } else {
          e.vx = 0
        }
      } else {
        e.vx = 0
      }

      e.shootTimer -= gameDt
      if (e.shootTimer <= 0) {
        e.shootTimer = (cfg.shootInterval / getDifficultyMult()) * (0.8 + Math.random() * 0.4)
        const angle = Math.atan2(
          (player.y + player.h / 2) - (e.y + e.h / 2),
          (player.x + player.w / 2) - (e.x + e.w / 2)
        )
        // Fire pellets (shotgunner fires spread)
        for (let p = 0; p < cfg.pellets; p++) {
          const spreadAngle = angle + (Math.random() - 0.5) * cfg.spread * 2
          const bx = e.x + e.w / 2 + Math.cos(angle) * 16
          const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
          bullets.push({
            x: bx, y: by,
            vx: Math.cos(spreadAngle) * cfg.bulletSpeed,
            vy: Math.sin(spreadAngle) * cfg.bulletSpeed,
            owner: 'enemy',
            life: BULLET_LIFE,
            trail: [],
            damage: cfg.damage,
          })
        }
        const bx = e.x + e.w / 2 + Math.cos(angle) * 16
        const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
        spawnMuzzleFlash(bx, by, angle)
      }
    }

    resolvePhysics(e, gameDt)
  }

  // ── Bullets ──
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.trail.push({ x: b.x, y: b.y })
    if (b.trail.length > 8) b.trail.shift()

    b.x += b.vx * gameDt
    b.y += b.vy * gameDt
    b.life -= gameDt

    if (b.life <= 0) { bullets.splice(i, 1); continue }

    // Hit platforms
    let hitWall = false
    for (const p of platforms) {
      if (b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h) {
        hitWall = true
        break
      }
    }
    if (hitWall) {
      spawnParticles(b.x, b.y, 5, '#ff8', 100)
      bullets.splice(i, 1)
      continue
    }

    // Hit cover boxes
    let hitBox = false
    for (let j = coverBoxes.length - 1; j >= 0; j--) {
      const box = coverBoxes[j]
      if (b.x >= box.x && b.x <= box.x + box.w && b.y >= box.y && b.y <= box.y + box.h) {
        box.hp -= b.damage
        spawnParticles(b.x, b.y, 4, box.type === 'barrel' ? '#884422' : '#aa8855', 80)
        if (box.hp <= 0) {
          // Destroy box — big particle burst
          SFX.explosion()
          spawnParticles(box.x + box.w / 2, box.y + box.h / 2, 15,
            box.type === 'barrel' ? '#ff6622' : '#aa8855', 200)
          screenShake = 6
          coverBoxes.splice(j, 1)
        }
        hitBox = true
        break
      }
    }
    if (hitBox) { bullets.splice(i, 1); continue }

    // Hit enemies (player bullets) — 3-zone hitbox: head, body, legs
    if (b.owner === 'player') {
      let hit = false
      for (const e of enemies) {
        if (e.state === 'dead') continue
        // Broad check first
        if (b.x < e.x || b.x > e.x + e.w || b.y < e.y || b.y > e.y + e.h) continue

        // Head: y+0 to y+14 (instakill)
        // Body: y+14 to y+34 (2-3 shots)
        // Legs: y+34 to y+44 (4 shots)
        let dmgMultiplier: number
        let hitZone: string
        const relY = b.y - e.y

        if (relY < 14) {
          dmgMultiplier = 100 // instakill
          hitZone = 'head'
        } else if (relY < 34) {
          dmgMultiplier = 2.5 // 2-3 pistol shots
          hitZone = 'body'
        } else {
          dmgMultiplier = 1 // ~4 pistol shots
          hitZone = 'legs'
        }

        const finalDamage = b.damage * dmgMultiplier
        e.hp -= finalDamage
        e.hitTimer = 0.3
        e.showHpTimer = 2

        // Damage number
        const dmgText = hitZone === 'head' ? 'HEADSHOT!' : Math.round(finalDamage).toString()
        const dmgColor = hitZone === 'head' ? '#ff2222' : hitZone === 'body' ? '#ffcc44' : '#ff8844'
        floatingTexts.push({
          x: b.x + (Math.random() - 0.5) * 10,
          y: b.y - 5,
          text: dmgText, color: dmgColor,
          life: 0.8, maxLife: 0.8,
        })

        // Visual feedback per zone
        hitMarkerTimer = 0.15
        if (hitZone === 'head') {
          spawnParticles(b.x, b.y, 15, '#ff2222', 200)
          screenShake = 8
          screenFlash = 'rgba(255,255,255,0.8)'
          screenFlashTimer = 0.08
          SFX.headshot()
        } else if (hitZone === 'body') {
          SFX.bulletImpact()
          spawnParticles(b.x, b.y, 8, '#f44', 150)
          screenShake = 5
        } else {
          spawnParticles(b.x, b.y, 5, '#f84', 100)
          screenShake = 3
          SFX.bulletImpact()
        }

        if (bloodDecals.length > 100) bloodDecals.shift()

        if (e.hp <= 0) {
          e.state = 'dead'
          SFX.enemyDeath()
          const deathFrames = enemyTypes[e.type]?.spriteConfig.death.frames ?? 10
          const deathFps = enemyTypes[e.type]?.spriteConfig.death.fps ?? 10
          e.deathTimer = (deathFrames / deathFps) + 2
          e.vy = 0
          e.vx = 0
          killCount++
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 20, '#f44', 250)
          screenShake = 10


          // Combo system
          comboCount++
          comboTimer = COMBO_WINDOW
          if (comboCount >= 2) {
            floatingTexts.push({
              x: e.x + e.w / 2, y: e.y - 25,
              text: `${comboCount}x COMBO!`, color: '#ffaa22',
              life: 1.0, maxLife: 1.0,
            })
          }

          // Blood splatter decal on ground
          bloodDecals.push({ x: e.x + e.w / 2, y: e.y + e.h, size: 15 + Math.random() * 15, alpha: 1 })

          // Ammo drop (40% chance)
          if (Math.random() < 0.4) {
            const dropTypes: WeaponType[] = ['shotgun', 'm16', 'sniper']
            const dropType = dropTypes[Math.floor(Math.random() * dropTypes.length)]
            const dropAmounts: Record<WeaponType, number> = { pistol: 0, shotgun: 4, m16: 15, sniper: 3 }
            ammoPickups.push({
              x: e.x + e.w / 2, y: e.y,
              vy: -120, onGround: false,
              life: 15, bobTimer: 0,
              weaponType: dropType,
              amount: dropAmounts[dropType],
            })
          }

          // Kill cam — slow-mo on last enemy of wave
          const aliveCount = enemies.filter(en => en !== e && en.state !== 'dead').length
          if (aliveCount === 0 && waveState === 'active') {
            killCamActive = true
            killCamTimer = 1.5
          }
        }
        hit = true
        break
      }
      if (hit) { bullets.splice(i, 1); continue }
    }

    // Hit player (enemy bullets)
    if (b.owner === 'enemy') {
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        player.hp -= b.damage
        player.hitFlash = 0.15
        screenFlash = 'rgba(255,0,0,0.7)'
        screenFlashTimer = 0.1
        SFX.playerHit()
        spawnParticles(b.x, b.y, 6, '#f88', 100)
        screenShake = 6
        bullets.splice(i, 1)
        if (player.hp <= 0) {
          gameOver = true
          deathSlowMo = true
          deathSlowMoTimer = 2.0
          spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 30, '#f44', 300)
          // Save high score
          if (totalScore > highScore) {
            highScore = totalScore
            localStorage.setItem('bulletTime2d_highScore', highScore.toString())
          }
        }
      }
    }
  }

  // ── Particles ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * gameDt
    p.y += p.vy * gameDt
    p.vy += 400 * gameDt
    p.life -= gameDt
    if (p.life <= 0) particles.splice(i, 1)
  }

  // ── Shell Casings ──
  for (let i = shellCasings.length - 1; i >= 0; i--) {
    const s = shellCasings[i]
    s.x += s.vx * gameDt
    s.y += s.vy * gameDt
    s.vy += GRAVITY * 0.5 * gameDt
    s.rotation += s.rotSpeed * gameDt
    s.life -= gameDt
    if (s.life <= 0) shellCasings.splice(i, 1)
  }

  // ── Health Pickups ──
  for (let i = healthPickups.length - 1; i >= 0; i--) {
    const hp = healthPickups[i]
    hp.vy += GRAVITY * gameDt
    hp.y += hp.vy * gameDt
    hp.life -= gameDt
    hp.bobTimer += gameDt * 4

    // Ground collision
    for (const p of platforms) {
      if (hp.x >= p.x && hp.x <= p.x + p.w && hp.y >= p.y && hp.y <= p.y + p.h) {
        hp.y = p.y
        hp.vy = 0
        hp.onGround = true
      }
    }

    // Player pickup
    const dist = Math.abs(hp.x - (player.x + player.w / 2)) + Math.abs(hp.y - (player.y + player.h / 2))
    if (dist < 30 && player.hp < PLAYER_MAX_HP) {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 20)
      floatingTexts.push({
        x: player.x + player.w / 2, y: player.y - 10,
        text: '+20 HP', color: '#44ff44',
        life: 0.8, maxLife: 0.8,
      })
      healthPickups.splice(i, 1)
      continue
    }

    if (hp.life <= 0) healthPickups.splice(i, 1)
  }

  // ── Floating Texts ──
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i]
    ft.y -= 40 * gameDt
    ft.life -= gameDt
    if (ft.life <= 0) floatingTexts.splice(i, 1)
  }

  // ── Combo Timer ──
  if (comboTimer > 0) {
    comboTimer -= gameDt
    if (comboTimer <= 0) comboCount = 0
  }

  // ── Hit Marker ──
  if (hitMarkerTimer > 0) hitMarkerTimer -= dt

  // ── Screen Flash ──
  if (screenFlashTimer > 0) screenFlashTimer -= dt

  // ── Kill Cam ──
  if (killCamActive) {
    killCamTimer -= dt
    if (killCamTimer <= 0) killCamActive = false
  }

  // ── Death Slow-mo ──
  if (deathSlowMo) {
    deathSlowMoTimer -= dt
    if (deathSlowMoTimer <= 0) deathSlowMo = false
  }

  // ── Ammo Pickups ──
  for (let i = ammoPickups.length - 1; i >= 0; i--) {
    const ap = ammoPickups[i]
    ap.vy += GRAVITY * gameDt
    ap.y += ap.vy * gameDt
    ap.life -= gameDt
    ap.bobTimer += gameDt * 4

    // Ground collision
    for (const p of platforms) {
      if (ap.x >= p.x && ap.x <= p.x + p.w && ap.y >= p.y && ap.y <= p.y + p.h) {
        ap.y = p.y
        ap.vy = 0
        ap.onGround = true
      }
    }

    // Player pickup
    const dist = Math.abs(ap.x - (player.x + player.w / 2)) + Math.abs(ap.y - (player.y + player.h / 2))
    if (dist < 30) {
      playerAmmo[ap.weaponType] = (playerAmmo[ap.weaponType] === -1 ? 0 : playerAmmo[ap.weaponType]) + ap.amount
      floatingTexts.push({
        x: player.x + player.w / 2, y: player.y - 10,
        text: `+${ap.amount} ${WEAPONS[ap.weaponType].name}`, color: WEAPONS[ap.weaponType].color,
        life: 0.8, maxLife: 0.8,
      })
      SFX.pickup()
      ammoPickups.splice(i, 1)
      continue
    }

    if (ap.life <= 0) ammoPickups.splice(i, 1)
  }

  // ── Camera Zoom ──
  const targetZoom = (player.bulletTimeActive || killCamActive) ? 1.12 : (deathSlowMo ? 1.15 : 1)
  baseCameraZoom += (targetZoom - baseCameraZoom) * 3 * dt

  // ── Camera ──
  const targetCamX = player.x + player.w / 2 - CANVAS_W / 2
  const targetCamY = player.y + player.h / 2 - CANVAS_H / 2 - 50
  camera.x += (targetCamX - camera.x) * 4 * dt
  camera.y += (targetCamY - camera.y) * 4 * dt
  camera.x = Math.max(0, Math.min(camera.x, 2400 - CANVAS_W))
  camera.y = Math.max(-200, Math.min(camera.y, 720 - CANVAS_H))

  // Wave system
  if (waveState === 'countdown') {
    waveTimer -= dt
    if (waveTimer <= 0) {
      startWave()
    }
  } else if (waveState === 'active') {
    const alive = enemies.filter(e => e.state !== 'dead').length
    if (alive === 0) {
      waveState = 'cleared'
      SFX.waveCleared()
      waveTimer = 4 // time to show score screen
      // Score: base kills + combo bonus + wave bonus
      totalScore += killCount * 10 + wave * 50
      // Respawn weapon pickups
      for (const wp of weaponPickups) wp.collected = false
      // Heal player slightly between waves
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 15)
    }
  } else if (waveState === 'cleared') {
    waveTimer -= dt
    if (waveTimer <= 0) {
      enemies.length = 0
      bloodDecals.length = 0
      spawnCoverBoxes()
      waveState = 'countdown'
      waveTimer = 3
    }
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────

function render() {
  ctx.save()

  // Screen shake offset
  const shakeX = (Math.random() - 0.5) * screenShake * 2
  const shakeY = (Math.random() - 0.5) * screenShake * 2
  ctx.translate(shakeX, shakeY)

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  gradient.addColorStop(0, '#0a0a1a')
  gradient.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Background city silhouette (parallax)
  ctx.fillStyle = '#111122'
  const parallax = camera.x * 0.3
  for (let i = 0; i < 15; i++) {
    const bx = i * 180 - parallax % 180 - 180
    const bh = 80 + Math.sin(i * 2.7) * 60 + Math.cos(i * 1.3) * 40
    ctx.fillRect(bx, CANVAS_H - bh - 100, 140, bh + 100)
    // Windows
    ctx.fillStyle = '#1a1a33'
    for (let wy = CANVAS_H - bh - 80; wy < CANVAS_H - 100; wy += 25) {
      for (let wx = bx + 15; wx < bx + 130; wx += 30) {
        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 12, 15)
      }
    }
    ctx.fillStyle = '#111122'
  }

  ctx.save()
  // Slow-mo camera zoom
  if (baseCameraZoom !== 1) {
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2)
    ctx.scale(baseCameraZoom, baseCameraZoom)
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2)
  }
  ctx.translate(-camera.x, -camera.y)

  // Bullet time tint
  if (player.bulletTimeActive) {
    ctx.fillStyle = 'rgba(20, 30, 60, 0.3)'
    ctx.fillRect(camera.x, camera.y, CANVAS_W, CANVAS_H)
  }

  // ── Platforms ──
  for (const p of platforms) {
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(p.x, p.y, p.w, p.h)
    ctx.fillStyle = '#4a4a6e'
    ctx.fillRect(p.x, p.y, p.w, 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(p.x, p.y, 2, p.h)
    ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h)
  }

  // ── Blood Decals ──
  for (const bd of bloodDecals) {
    ctx.globalAlpha = bd.alpha
    ctx.fillStyle = '#551111'
    // Pixelated blood — random squares
    const s = bd.size
    for (let px = -s; px < s; px += 4) {
      for (let py = -2; py <= 2; py += 4) {
        if (Math.abs(px) + Math.abs(py) * 3 < s) {
          ctx.fillRect(bd.x + px, bd.y + py, 4, 3)
        }
      }
    }
    ctx.fillStyle = '#440000'
    ctx.fillRect(bd.x - s * 0.3, bd.y - 1, s * 0.6, 2)
  }
  ctx.globalAlpha = 1

  // ── Cover Boxes ──
  for (const box of coverBoxes) {
    const dmgRatio = box.hp / box.maxHp

    if (box.type === 'crate') {
      ctx.fillStyle = '#8B6914'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#A07818'
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4)
      // Cross planks
      ctx.fillStyle = '#8B6914'
      ctx.fillRect(box.x + box.w / 2 - 1, box.y, 2, box.h)
      ctx.fillRect(box.x, box.y + box.h / 2 - 1, box.w, 2)
    } else if (box.type === 'barrel') {
      ctx.fillStyle = '#664433'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#775544'
      ctx.fillRect(box.x + 2, box.y + 3, box.w - 4, box.h - 6)
      // Metal bands
      ctx.fillStyle = '#555555'
      ctx.fillRect(box.x, box.y + 4, box.w, 2)
      ctx.fillRect(box.x, box.y + box.h - 6, box.w, 2)
    } else {
      // Sandbag
      ctx.fillStyle = '#8B8B6B'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#9B9B7B'
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4)
      // Bag lines
      ctx.fillStyle = '#7B7B5B'
      for (let sx = box.x + 8; sx < box.x + box.w; sx += 12) {
        ctx.fillRect(sx, box.y, 1, box.h)
      }
    }

    // Damage cracks
    if (dmgRatio < 0.6) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(box.x + box.w * 0.3, box.y + 2, 2, box.h * 0.4)
      ctx.fillRect(box.x + box.w * 0.6, box.y + box.h * 0.3, 2, box.h * 0.5)
    }
    if (dmgRatio < 0.3) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(box.x + 3, box.y + box.h * 0.5, box.w * 0.4, 2)
    }

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(box.x, box.y, box.w, 1)
  }

  // ── Weapon Pickups ──
  for (const wp of weaponPickups) {
    if (wp.collected) continue
    const bob = Math.sin(wp.bobTimer) * 4
    const wpDef = WEAPONS[wp.type]
    const ws = weaponSprites[wp.type]
    const wx = wp.x
    const wy = wp.y + bob

    // Glow
    ctx.fillStyle = wpDef.color + '22'
    ctx.beginPath()
    ctx.arc(wx + wp.w / 2, wy + wp.h / 2, 18, 0, Math.PI * 2)
    ctx.fill()

    // Weapon sprite or fallback
    ctx.imageSmoothingEnabled = false
    if (ws?.loaded) {
      const pickupScale = 20 / ws.h
      const drawW = ws.w * pickupScale
      const drawH = ws.h * pickupScale
      ctx.drawImage(ws.image, wx + wp.w / 2 - drawW / 2, wy + wp.h / 2 - drawH / 2, drawW, drawH)
    } else {
      ctx.fillStyle = wpDef.color
      ctx.fillRect(wx, wy, wp.w, wp.h)
    }

    // Label
    ctx.fillStyle = wpDef.color
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(wpDef.name, wx + wp.w / 2, wy - 6)
    ctx.textAlign = 'left'
  }

  // ── Bullets ──
  for (const b of bullets) {
    ctx.strokeStyle = b.owner === 'player' ? 'rgba(255,200,50,0.4)' : 'rgba(255,80,80,0.4)'
    ctx.lineWidth = 2
    if (b.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(b.trail[0].x, b.trail[0].y)
      for (let j = 1; j < b.trail.length; j++) {
        ctx.lineTo(b.trail[j].x, b.trail[j].y)
      }
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.fillStyle = b.owner === 'player' ? '#ffc832' : '#ff5555'
    ctx.beginPath()
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
    ctx.fill()

    if (player.bulletTimeActive) {
      ctx.fillStyle = b.owner === 'player' ? 'rgba(255,200,50,0.3)' : 'rgba(255,80,80,0.3)'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── Enemies ──
  for (const e of enemies) {
    if (e.state === 'dead' && e.deathTimer <= 0) continue

    // Only fade during the last 2 seconds (after death animation finishes)
    const alpha = e.state === 'dead' ? Math.max(0, Math.min(1, e.deathTimer / 2)) : 1
    ctx.globalAlpha = alpha

    // Try sprite rendering
    if (!drawEnemySprite(e)) {
      // Fallback to rectangles
      const ex = e.x, ey = e.y

      ctx.fillStyle = e.state === 'dead' ? '#553333' : e.state === 'alert' ? '#884444' : '#666677'
      ctx.fillRect(ex + 4, ey + 12, 16, 22)

      ctx.fillStyle = e.state === 'dead' ? '#553333' : '#777788'
      ctx.fillRect(ex + 6, ey, 12, 14)

      if (e.state !== 'dead') {
        ctx.fillStyle = e.state === 'alert' ? '#ff4444' : '#aaaacc'
        const eyeX = e.facing > 0 ? ex + 13 : ex + 8
        ctx.fillRect(eyeX, ey + 4, 3, 3)
      }


      ctx.fillStyle = e.state === 'dead' ? '#443333' : '#555566'
      ctx.fillRect(ex + 5, ey + 34, 5, 10)
      ctx.fillRect(ex + 14, ey + 34, 5, 10)
    }

    // Enemy weapon sprite
    if (e.state !== 'dead') {
      const behaviorWeapon: Record<EnemyBehavior, WeaponType> = {
        grunt: 'pistol', shotgunner: 'shotgun', sniper: 'sniper', rusher: 'm16', boss: 'shotgun',
      }
      const ew = weaponSprites[behaviorWeapon[e.behavior]]
      const eArmX = e.x + e.w / 2
      const eArmY = e.y + e.h / 2 - 4
      const eGunAngle = e.state === 'alert'
        ? Math.atan2((player.y + player.h / 2) - eArmY, (player.x + player.w / 2) - eArmX)
        : e.facing > 0 ? 0 : Math.PI
      const flipEGun = Math.abs(eGunAngle) > Math.PI / 2

      ctx.save()
      ctx.translate(eArmX, eArmY)
      ctx.rotate(eGunAngle)
      if (flipEGun) ctx.scale(1, -1)
      ctx.imageSmoothingEnabled = false
      if (ew?.loaded) {
        const targetH = 12
        const scale = targetH / ew.h
        ctx.drawImage(ew.image, 0, -ew.h * scale / 2, ew.w * scale, ew.h * scale)
      } else {
        ctx.fillStyle = '#555566'
        ctx.fillRect(0, -2, 14, 4)
      }
      ctx.restore()
    }

    ctx.globalAlpha = 1

    // Health bar (shows when recently hit)
    if (e.state !== 'dead' && e.showHpTimer > 0) {
      const barW = 30
      const barH = 3
      const barX = e.x + e.w / 2 - barW / 2
      const barY = e.y - 8
      const hpRatio = Math.max(0, e.hp / e.maxHp)

      ctx.fillStyle = '#222'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = hpRatio > 0.5 ? '#44aa55' : hpRatio > 0.25 ? '#ddaa22' : '#dd3333'
      ctx.fillRect(barX, barY, barW * hpRatio, barH)

      // Behavior indicator color
      const behaviorColors: Record<EnemyBehavior, string> = {
        grunt: '#888', shotgunner: '#ff8844', sniper: '#44aaff', rusher: '#ff4466', boss: '#ff22ff',
      }
      ctx.fillStyle = behaviorColors[e.behavior]
      ctx.fillRect(barX, barY - 2, barW, 1)
    }
  }

  // ── Player ──
  const px = player.x, py = player.y


  if (player.diving || player.rolling) {
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#6688ff'
    ctx.fillRect(px - player.vx * 0.03, py - player.vy * 0.03, player.w, player.h)
    ctx.globalAlpha = 0.1
    ctx.fillRect(px - player.vx * 0.06, py - player.vy * 0.06, player.w, player.h)
    ctx.globalAlpha = 1
  }

  // Try sprite rendering first
  const playerAnim = getPlayerAnim()
  const playerSheet = playerSprites[playerAnim]
  const flipX = player.facing < 0
  let spriteDrawn = false

  if (playerSheet?.loaded) {
    let rotation = 0
    if (player.rolling) {
      rotation = player.rollDir * (1 - player.rollTimer / 0.4) * Math.PI * 2
    } else if (player.doubleJumping) {
      rotation = player.doubleJumpSpin
    }
    const shouldLoop = playerAnim !== 'fall' && playerAnim !== 'jump' && playerAnim !== 'pickup' && playerAnim !== 'dive' && playerAnim !== 'crouch' && playerAnim !== 'uncrouch' && playerAnim !== 'land'
    const anchorBottom = playerAnim === 'dive'
    const crouchOffset = (playerAnim === 'crouch' || playerAnim === 'uncrouch') ? -8 : 0
    const doubleJumpFrame = player.doubleJumping ? spriteConfig.roll.frames - 1 : -1
    spriteDrawn = drawSprite(playerSheet, px, py + crouchOffset, flipX, rotation, shouldLoop, anchorBottom, doubleJumpFrame)
  }

  // Fallback to rectangle art if sprites not loaded
  if (!spriteDrawn) {
    const bodyColor = player.diving || player.rolling ? '#4466cc' : '#3355aa'
    ctx.fillStyle = bodyColor
    if (player.rolling) {
      ctx.save()
      ctx.translate(px + player.w / 2, py + player.h / 2)
      ctx.rotate(player.rollDir * (1 - player.rollTimer / 0.4) * Math.PI * 2)
      ctx.fillStyle = '#3355aa'
      ctx.fillRect(-12, -12, 24, 24)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(-5, -12, 10, 8)
      ctx.restore()
    } else if (player.diving) {
      ctx.save()
      ctx.translate(px + player.w / 2, py + player.h / 2)
      ctx.rotate(player.diveDir * player.diveTimer * 3)
      ctx.fillRect(-player.w / 2, -player.h / 2 + 10, player.w, player.h - 10)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(-5, -player.h / 2, 12, 14)
      ctx.restore()
    } else if (player.crouching) {
      ctx.fillStyle = '#3355aa'
      ctx.fillRect(px + 2, py + 6, 20, 14)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(px + 6, py - 2, 12, 10)
      ctx.fillStyle = '#224488'
      const eyeX = player.facing > 0 ? px + 13 : px + 8
      ctx.fillRect(eyeX, py + 1, 3, 3)
      ctx.fillStyle = '#223366'
      ctx.fillRect(px + 3, py + 20, 7, 8)
      ctx.fillRect(px + 14, py + 20, 7, 8)
    } else {
      ctx.fillRect(px + 4, py + 12, 16, 22)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(px + 6, py, 12, 14)
      ctx.fillStyle = '#224488'
      const eyeX = player.facing > 0 ? px + 13 : px + 8
      ctx.fillRect(eyeX, py + 4, 3, 3)
      ctx.fillStyle = '#223366'
      ctx.fillRect(px + 5, py + 34, 5, 10)
      ctx.fillRect(px + 14, py + 34, 5, 10)
    }
  }

  // Gun arm — render based on current weapon
  const aimWorldX = mouse.x + camera.x
  const aimWorldY = mouse.y + camera.y
  const armX = px + player.w / 2
  const armY = py + player.h / 2 - 4
  const gunAngle = Math.atan2(aimWorldY - armY, aimWorldX - armX)
  const flipGun = Math.abs(gunAngle) > Math.PI / 2

  const ws = weaponSprites[currentWeapon]
  ctx.save()
  ctx.translate(armX, armY)
  ctx.rotate(gunAngle)
  if (flipGun) ctx.scale(1, -1)
  ctx.imageSmoothingEnabled = false

  if (ws?.loaded) {
    const targetH = 12
    const scale = targetH / ws.h
    const drawW = ws.w * scale
    const drawH = ws.h * scale
    ctx.drawImage(ws.image, 0, -drawH / 2, drawW, drawH)
  } else {
    // Fallback rectangles
    if (currentWeapon === 'shotgun') {
      ctx.fillStyle = '#555566'
      ctx.fillRect(0, -3, 28, 6)
      ctx.fillStyle = '#888899'
      ctx.fillRect(26, -4, 4, 8)
    } else if (currentWeapon === 'm16') {
      ctx.fillStyle = '#555566'
      ctx.fillRect(0, -2, 18, 4)
      ctx.fillStyle = '#888899'
      ctx.fillRect(16, -3, 4, 6)
    } else {
      ctx.fillStyle = '#555566'
      ctx.fillRect(0, -2, 20, 5)
      ctx.fillStyle = '#888899'
      ctx.fillRect(18, -3, 4, 7)
    }
  }
  ctx.restore()

  // ── Particles ──
  for (const p of particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // ── Shell Casings ──
  for (const s of shellCasings) {
    ctx.globalAlpha = Math.min(1, s.life)
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.rotation)
    ctx.fillStyle = '#cc9933'
    ctx.fillRect(-2, -1, 4, 2)
    ctx.restore()
  }
  ctx.globalAlpha = 1

  // ── Health Pickups ──
  for (const hp of healthPickups) {
    const bob = Math.sin(hp.bobTimer) * (hp.onGround ? 3 : 0)
    ctx.fillStyle = '#44ff44'
    ctx.fillRect(hp.x - 5, hp.y - 5 + bob, 12, 12)
    ctx.fillStyle = '#22aa22'
    ctx.fillRect(hp.x - 1, hp.y - 3 + bob, 4, 8)
    ctx.fillRect(hp.x - 3, hp.y - 1 + bob, 8, 4)
  }

  // ── Ammo Pickups ──
  for (const ap of ammoPickups) {
    const bob = Math.sin(ap.bobTimer) * (ap.onGround ? 3 : 0)
    const color = WEAPONS[ap.weaponType].color
    ctx.fillStyle = color
    ctx.fillRect(ap.x - 6, ap.y - 4 + bob, 12, 8)
    ctx.fillStyle = '#222'
    ctx.fillRect(ap.x - 4, ap.y - 2 + bob, 8, 4)
    ctx.fillStyle = color
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(WEAPONS[ap.weaponType].name, ap.x, ap.y - 7 + bob)
    ctx.textAlign = 'left'
  }

  // ── Floating Texts ──
  for (const ft of floatingTexts) {
    ctx.globalAlpha = ft.life / ft.maxLife
    ctx.fillStyle = ft.color
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.textAlign = 'left'
  }
  ctx.globalAlpha = 1

  // ── Crosshair ──
  // Hit marker flash
  const crossColor = hitMarkerTimer > 0 ? '#ff4444' : (player.bulletTimeActive ? '#ff6644' : '#ffffff')
  ctx.strokeStyle = crossColor
  ctx.lineWidth = 1.5
  const crossX = aimWorldX
  const crossY = aimWorldY
  ctx.beginPath()
  ctx.arc(crossX, crossY, 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(crossX - 15, crossY); ctx.lineTo(crossX - 6, crossY)
  ctx.moveTo(crossX + 6, crossY); ctx.lineTo(crossX + 15, crossY)
  ctx.moveTo(crossX, crossY - 15); ctx.lineTo(crossX, crossY - 6)
  ctx.moveTo(crossX, crossY + 6); ctx.lineTo(crossX, crossY + 15)
  ctx.stroke()

  ctx.restore() // camera

  // ─── HUD ───
  // HP bar
  ctx.fillStyle = '#222'
  ctx.fillRect(20, 20, 200, 16)
  const hpRatio = Math.max(0, player.hp / PLAYER_MAX_HP)
  ctx.fillStyle = hpRatio > 0.3 ? '#44aa55' : '#dd3333'
  ctx.fillRect(20, 20, 200 * hpRatio, 16)
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  ctx.strokeRect(20, 20, 200, 16)

  ctx.fillStyle = '#fff'
  ctx.font = '11px monospace'
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 24, 33)

  // Bullet time bar
  ctx.fillStyle = '#222'
  ctx.fillRect(20, 42, 200, 10)
  const btRatio = player.bulletTimeEnergy / BULLET_TIME_MAX
  ctx.fillStyle = player.bulletTimeActive ? '#ff6644' : '#4488ff'
  ctx.fillRect(20, 42, 200 * btRatio, 10)
  ctx.strokeStyle = '#555'
  ctx.strokeRect(20, 42, 200, 10)

  ctx.fillStyle = '#aaa'
  ctx.font = '10px monospace'
  ctx.fillText('BULLET TIME [SHIFT]', 24, 51)

  // Weapon display
  const wpDef = WEAPONS[currentWeapon]
  ctx.fillStyle = wpDef.color
  ctx.font = 'bold 14px monospace'
  ctx.fillText(wpDef.name, 20, 74)

  // Mag display
  if (player.reloading) {
    ctx.fillStyle = '#ff8844'
    ctx.font = 'bold 12px monospace'
    const reloadPct = Math.floor((1 - player.reloadTimer / wpDef.reloadTime) * 100)
    ctx.fillText(`RELOADING... ${reloadPct}%`, 20, 90)
  } else {
    const magColor = magRounds[currentWeapon] <= Math.ceil(wpDef.magSize * 0.2) ? '#ff4444' : '#aaa'
    ctx.fillStyle = magColor
    ctx.font = '12px monospace'
    ctx.fillText(`MAG: ${magRounds[currentWeapon]} / ${wpDef.magSize}`, 20, 90)
  }

  // Weapon slots
  const slotY = 100
  const allWeapons: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper']
  for (let i = 0; i < allWeapons.length; i++) {
    const w = allWeapons[i]
    const hasAmmo = playerAmmo[w] === -1 || playerAmmo[w] > 0
    const isActive = w === currentWeapon

    ctx.fillStyle = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'
    ctx.fillRect(20 + i * 56, slotY, 50, 20)
    if (isActive) {
      ctx.strokeStyle = WEAPONS[w].color
      ctx.lineWidth = 1
      ctx.strokeRect(20 + i * 56, slotY, 50, 20)
    }

    ctx.fillStyle = hasAmmo ? (isActive ? '#fff' : '#888') : '#333'
    ctx.font = '9px monospace'
    ctx.fillText(`${i + 1} ${WEAPONS[w].name}`, 24 + i * 56, slotY + 13)
  }

  // Kill count
  ctx.fillStyle = '#cc4444'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(`KILLS: ${killCount}`, CANVAS_W - 140, 34)

  // Combo display
  if (comboCount >= 2) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = `bold ${16 + comboCount * 2}px monospace`
    ctx.fillText(`${comboCount}x COMBO`, CANVAS_W - 160, 58)
  }

  // Wave display
  ctx.fillStyle = '#aaa'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`WAVE ${wave}`, CANVAS_W / 2 - 30, 20)
  ctx.fillStyle = '#666'
  ctx.font = '10px monospace'
  ctx.fillText(`SCORE: ${totalScore}`, CANVAS_W / 2 - 30, 34)

  // Wave countdown
  if (waveState === 'countdown') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave + 1}`, CANVAS_W / 2, CANVAS_H / 2 - 5)
    ctx.fillStyle = '#aaa'
    ctx.font = '18px monospace'
    ctx.fillText(`Starting in ${Math.ceil(waveTimer)}...`, CANVAS_W / 2, CANVAS_H / 2 + 25)
    ctx.textAlign = 'left'
  }

  // Wave cleared screen
  if (waveState === 'cleared') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, CANVAS_H / 2 - 60, CANVAS_W, 120)
    ctx.fillStyle = '#44ff44'
    ctx.font = 'bold 32px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave} CLEARED!`, CANVAS_W / 2, CANVAS_H / 2 - 20)
    ctx.fillStyle = '#fff'
    ctx.font = '16px monospace'
    ctx.fillText(`Kills: ${killCount}  |  Score: ${totalScore}`, CANVAS_W / 2, CANVAS_H / 2 + 10)
    ctx.fillStyle = '#88ff88'
    ctx.font = '12px monospace'
    ctx.fillText('+15 HP recovered', CANVAS_W / 2, CANVAS_H / 2 + 35)
    ctx.textAlign = 'left'
  }

  // Controls hint
  ctx.fillStyle = '#555'
  ctx.font = '11px monospace'
  ctx.fillText('WASD: Move | Double-tap A/D: Dive | Shift: Bullet Time | 1/2/3 or Scroll: Weapons | R: Reload', 20, CANVAS_H - 14)

  // Bullet time overlay
  if (player.bulletTimeActive) {
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.15)'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = 'rgba(255, 100, 50, 0.7)'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('● BULLET TIME', CANVAS_W / 2 - 60, 30)
  }

  // Screen flash border
  if (screenFlashTimer > 0 && screenFlash) {
    const borderW = 6
    ctx.fillStyle = screenFlash
    ctx.fillRect(0, 0, CANVAS_W, borderW)
    ctx.fillRect(0, CANVAS_H - borderW, CANVAS_W, borderW)
    ctx.fillRect(0, 0, borderW, CANVAS_H)
    ctx.fillRect(CANVAS_W - borderW, 0, borderW, CANVAS_H)
  }

  // Kill cam indicator
  if (killCamActive) {
    ctx.fillStyle = 'rgba(255, 200, 50, 0.6)'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('● LAST KILL', CANVAS_W / 2, CANVAS_H - 50)
    ctx.textAlign = 'left'
  }

  // Parallax foreground — subtle fog/debris
  ctx.globalAlpha = 0.04
  ctx.fillStyle = '#aabbcc'
  const fgParallax = camera.x * 1.3
  for (let i = 0; i < 8; i++) {
    const fx = i * 200 - fgParallax % 200 - 100
    const fy = 500 + Math.sin(gameTime * 0.3 + i * 1.7) * 30
    ctx.fillRect(fx, fy, 120 + Math.sin(i * 3.1) * 40, 3)
  }
  ctx.globalAlpha = 1

  // Game over
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#ff3333'
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('WASTED', CANVAS_W / 2, CANVAS_H / 2 - 30)

    ctx.fillStyle = '#aaa'
    ctx.font = '18px monospace'
    ctx.fillText(`Wave: ${wave}  |  Kills: ${killCount}  |  Score: ${totalScore}`, CANVAS_W / 2, CANVAS_H / 2 + 10)

    ctx.fillStyle = highScore === totalScore && totalScore > 0 ? '#ffaa22' : '#888'
    ctx.font = '14px monospace'
    ctx.fillText(`High Score: ${highScore}${highScore === totalScore && totalScore > 0 ? ' ★ NEW!' : ''}`, CANVAS_W / 2, CANVAS_H / 2 + 35)

    ctx.fillStyle = '#666'
    ctx.font = '14px monospace'
    ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 65)
    ctx.textAlign = 'left'
  }

  // Pause menu
  if (gameState === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 40)
    ctx.fillStyle = '#aaa'
    ctx.font = '14px monospace'
    ctx.fillText('WASD: Move  |  Mouse: Aim & Shoot  |  Shift: Bullet Time', CANVAS_W / 2, CANVAS_H / 2 + 5)
    ctx.fillText('Double-tap A/D: Dive  |  S: Crouch  |  1/2/3: Weapons  |  R: Reload', CANVAS_W / 2, CANVAS_H / 2 + 25)
    ctx.fillStyle = '#666'
    ctx.fillText('Press ESC to resume', CANVAS_W / 2, CANVAS_H / 2 + 60)
    ctx.textAlign = 'left'
  }

  ctx.restore() // shake
}

// ─── Title Screen ────────────────────────────────────────────────────────────

function renderTitleScreen() {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  gradient.addColorStop(0, '#0a0a1a')
  gradient.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // City silhouette
  ctx.fillStyle = '#111122'
  for (let i = 0; i < 10; i++) {
    const bx = i * 140 + 20
    const bh = 80 + Math.sin(i * 2.7) * 60
    ctx.fillRect(bx, CANVAS_H - bh - 100, 100, bh + 100)
  }

  // Title
  ctx.fillStyle = '#ff3333'
  ctx.font = 'bold 52px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('BULLET TIME', CANVAS_W / 2, CANVAS_H / 2 - 80)
  ctx.fillStyle = '#ffc832'
  ctx.font = 'bold 28px monospace'
  ctx.fillText('2 D', CANVAS_W / 2, CANVAS_H / 2 - 45)

  // High score
  if (highScore > 0) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = '14px monospace'
    ctx.fillText(`High Score: ${highScore}`, CANVAS_W / 2, CANVAS_H / 2 - 10)
  }

  // Controls
  ctx.fillStyle = '#888'
  ctx.font = '13px monospace'
  ctx.fillText('WASD: Move  |  Mouse: Aim & Shoot  |  Shift: Bullet Time', CANVAS_W / 2, CANVAS_H / 2 + 30)
  ctx.fillText('Double-tap A/D: Dive  |  S: Crouch  |  1/2/3: Weapons', CANVAS_W / 2, CANVAS_H / 2 + 50)

  // Start prompt
  const pulse = 0.5 + Math.sin(gameTime * 3) * 0.5
  ctx.globalAlpha = 0.5 + pulse * 0.5
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('Click to Start', CANVAS_W / 2, CANVAS_H / 2 + 100)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

// ─── Restart ─────────────────────────────────────────────────────────────────

function restart() {
  player.x = 100; player.y = 500
  player.vx = 0; player.vy = 0
  player.hp = PLAYER_MAX_HP
  player.diving = false; player.diveTimer = 0
  player.crouching = false; player.rolling = false; player.rollTimer = 0
  player.h = player.standingH
  player.jumpCount = 0
  player.doubleJumping = false
  player.doubleJumpSpin = 0
  player.jumpHoldTime = 0
  player.jumpWasReleased = true
  player.landingTimer = 0
  player.bulletTimeEnergy = BULLET_TIME_MAX
  player.bulletTimeActive = false
  player.hitFlash = 0
  bullets.length = 0
  particles.length = 0
  enemies.length = 0
  healthPickups.length = 0
  ammoPickups.length = 0
  floatingTexts.length = 0
  shellCasings.length = 0
  bloodDecals.length = 0
  comboCount = 0
  comboTimer = 0
  hitMarkerTimer = 0
  killCount = 0
  totalScore = 0
  wave = 0
  waveState = 'countdown'
  waveTimer = 3
  gameOver = false
  deathSlowMo = false
  deathSlowMoTimer = 0
  killCamActive = false
  killCamTimer = 0
  screenFlash = ''
  screenFlashTimer = 0
  currentWeapon = 'pistol'
  player.reloading = false
  player.reloadTimer = 0
  playerAmmo.pistol = -1
  playerAmmo.shotgun = 12
  playerAmmo.m16 = 90
  playerAmmo.sniper = 10
  magRounds.pistol = WEAPONS.pistol.magSize
  magRounds.shotgun = WEAPONS.shotgun.magSize
  magRounds.m16 = WEAPONS.m16.magSize
  magRounds.sniper = WEAPONS.sniper.magSize
  for (const wp of weaponPickups) wp.collected = false
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

let lastTime = 0

function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05) // cap delta
  lastTime = timestamp

  if (gameState === 'title') {
    gameTime += dt
    renderTitleScreen()
  } else if (gameState === 'paused') {
    render() // still render the game behind the pause overlay
  } else {
    update(dt)
    render()
  }
  requestAnimationFrame(gameLoop)
}

requestAnimationFrame((t) => {
  lastTime = t
  gameLoop(t)
})
