// ─── Shared Constants (used by both server and client) ──────────────────────

import type { EnemyBehavior, EnemyConfig, WeaponDef, WeaponType } from './types'

export const GRAVITY = 1800
export const BULLET_LIFE = 2
export const GRENADE_FUSE = 1.5
export const GRENADE_RADIUS = 100
export const GRENADE_BOUNCE_DAMP = 0.5

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  pistol:   { name: 'PISTOL',   fireRate: 0.12, bulletSpeed: 900,  damage: 15, pellets: 1, spread: 0,    shake: 3,  color: '#ffc832', ammo: -1, auto: false, magSize: 12, reloadTime: 1.0 },
  shotgun:  { name: 'SHOTGUN',  fireRate: 0.3,  bulletSpeed: 800,  damage: 12, pellets: 7, spread: 0.18, shake: 8,  color: '#ff8844', ammo: 16, auto: false, magSize: 6,  reloadTime: 1.5 },
  m16:      { name: 'M16',      fireRate: 0.05, bulletSpeed: 850,  damage: 8,  pellets: 1, spread: 0.08, shake: 2,  color: '#44ddff', ammo: 60, auto: true,  magSize: 30, reloadTime: 1.8 },
  sniper:   { name: 'SNIPER',   fireRate: 1.2,  bulletSpeed: 1200, damage: 45, pellets: 1, spread: 0,    shake: 12, color: '#aa44ff', ammo: 10, auto: false, magSize: 5,  reloadTime: 2.2 },
  grenades: { name: 'GRENADES', fireRate: 0.8,  bulletSpeed: 800,  damage: 80, pellets: 1, spread: 0,    shake: 4,  color: '#88cc44', ammo: 3,  auto: false, magSize: 1,  reloadTime: 0.5 },
}

export const ENEMY_CONFIGS: Record<EnemyBehavior, EnemyConfig> = {
  grunt:      { hp: 60,  speed: 60,  shootInterval: 1.5, bulletSpeed: 500, damage: 8,  pellets: 1, spread: 0,    sightRange: 500 },
  shotgunner: { hp: 80,  speed: 40,  shootInterval: 2.0, bulletSpeed: 400, damage: 6,  pellets: 5, spread: 0.15, sightRange: 350 },
  sniper:     { hp: 40,  speed: 30,  shootInterval: 2.5, bulletSpeed: 800, damage: 20, pellets: 1, spread: 0,    sightRange: 800 },
  rusher:     { hp: 50,  speed: 160, shootInterval: 0.8, bulletSpeed: 450, damage: 6,  pellets: 1, spread: 0.1,  sightRange: 600 },
  boss:       { hp: 500, speed: 50,  shootInterval: 0.6, bulletSpeed: 550, damage: 12, pellets: 3, spread: 0.12, sightRange: 700 },
  drone:      { hp: 25,  speed: 120, shootInterval: 1.2, bulletSpeed: 600, damage: 5,  pellets: 1, spread: 0.05, sightRange: 600 },
}
