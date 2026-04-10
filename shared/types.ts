// ─── Shared Types (used by both server and client) ──────────────────────────

export interface Vec2 { x: number; y: number }

export interface Rect {
  x: number; y: number; w: number; h: number
  destructible?: boolean; hp?: number; maxHp?: number
}

export type EnemyBehavior = 'grunt' | 'shotgunner' | 'sniper' | 'rusher' | 'boss' | 'drone'
export type EnemyState = 'idle' | 'alert' | 'dead'
export type WeaponType = 'pistol' | 'shotgun' | 'm16' | 'sniper' | 'grenades'

export interface WeaponDef {
  name: string; fireRate: number; bulletSpeed: number; damage: number
  pellets: number; spread: number; shake: number; color: string
  ammo: number; auto: boolean; magSize: number; reloadTime: number
}

export interface EnemyConfig {
  hp: number; speed: number; shootInterval: number; bulletSpeed: number
  damage: number; pellets: number; spread: number; sightRange: number
}

export interface ServerEnemy {
  x: number; y: number; w: number; h: number
  vx: number; vy: number; hp: number; maxHp: number
  onGround: boolean; facing: number
  state: EnemyState; behavior: EnemyBehavior; type: string
  shootTimer: number; alertTimer: number
  patrolDir: number; patrolTimer: number
  deathTimer: number; hitTimer: number
}

export interface ServerBullet {
  x: number; y: number; vx: number; vy: number
  owner: 'player' | 'enemy'; life: number; damage: number
  penetrate?: boolean
}

export interface CoverBox {
  x: number; y: number; w: number; h: number
  hp: number; maxHp: number; type: 'crate' | 'barrel' | 'sandbag' | 'explosive'
  vy?: number; falling?: boolean
}

export interface WeaponPickup {
  x: number; y: number; w: number; h: number
  type: WeaponType; bobTimer: number; collected: boolean
}

export interface ServerPlayer {
  x: number; y: number; w: number; h: number; hp: number; facing: number
}

export interface LevelLayout {
  platforms: Rect[]; spawnPositions: Vec2[]
}
