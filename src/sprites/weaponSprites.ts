// ─── Weapon Sprites ──────────────────────────────────────────────────────────

import type { WeaponSprite, WeaponType } from '../types'

export const weaponSprites: Record<WeaponType, WeaponSprite> = {} as any

export function loadWeaponSprites() {
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
