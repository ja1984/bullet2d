// ─── Types ───────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
  destructible?: boolean
  hp?: number
  maxHp?: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  owner: 'player' | 'enemy'
  life: number
  trail: Vec2[]
  damage: number
  penetrate?: boolean
  ricocheted?: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type EnemyBehavior = 'grunt' | 'shotgunner' | 'sniper' | 'rusher' | 'boss' | 'drone'

export type EnemyAnim = 'idle' | 'walk' | 'hit' | 'death'

export interface Enemy {
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

export interface HealthPickup {
  x: number
  y: number
  vy: number
  onGround: boolean
  life: number
  bobTimer: number
}

export interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

export interface ShellCasing {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  life: number
}

export interface BloodDecal {
  x: number
  y: number
  size: number
  alpha: number
}

export interface CoverBox {
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  type: 'crate' | 'barrel' | 'sandbag' | 'explosive'
}

export interface AmmoPickup {
  x: number
  y: number
  vy: number
  onGround: boolean
  life: number
  bobTimer: number
  weaponType: WeaponType
  amount: number
}

export interface Grenade {
  x: number
  y: number
  vx: number
  vy: number
  fuseTimer: number
  bounces: number
}

export interface KillFeedEntry {
  text: string
  color: string
  life: number
  maxLife: number
}

export interface SteamVent {
  x: number
  y: number
  timer: number
  interval: number
  active: boolean
  burstTimer: number
}

export interface Puddle {
  x: number
  y: number
  w: number
}

export interface Streetlight {
  x: number
  y: number
  on: boolean
  flickerTimer: number
}

export interface Pigeon {
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  scattered: boolean
  life: number
  peckTimer: number
}

export interface Helicopter {
  x: number
  y: number
  vx: number
  blinkTimer: number
}

export type WeaponType = 'pistol' | 'shotgun' | 'm16' | 'sniper' | 'grenades'

export interface WeaponDef {
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

export interface WeaponPickup {
  x: number
  y: number
  w: number
  h: number
  type: WeaponType
  bobTimer: number
  collected: boolean
}

export type PlayerAnim = 'idle' | 'run' | 'jump' | 'fall' | 'dive' | 'crouch' | 'uncrouch' | 'roll' | 'pickup' | 'land'

export interface SpriteAnim {
  frames: HTMLImageElement[]
  fps: number
  loaded: boolean
}

export interface WeaponSprite {
  image: HTMLImageElement
  w: number
  h: number
  loaded: boolean
}

export interface EnemyTypeDef {
  sprites: Record<EnemyAnim, SpriteAnim>
  spriteConfig: Record<EnemyAnim, { frames: number; fps: number }>
}
