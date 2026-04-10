// ─── Pickups ─────────────────────────────────────────────────────────────────

import type { Rect, Vec2, WeaponType } from '../types'
import { GRAVITY, PLAYER_MAX_HP, WEAPONS, platforms } from '../constants'
import { state } from '../state'
import { SFX } from '../audio'
import { rectsOverlap } from './physics'
import { sendWeaponCollected } from './network'

export function updateWeaponPickups(dt: number) {
  const { weaponPickups, player, floatingTexts } = state

  for (const wp of weaponPickups) {
    if (wp.collected) continue
    wp.bobTimer += dt * 3
    const pr: Rect = { x: player.x, y: player.y, w: player.w, h: player.h }
    const wr: Rect = { x: wp.x, y: wp.y - Math.sin(wp.bobTimer) * 4, w: wp.w, h: wp.h }
    if (rectsOverlap(pr, wr)) {
      wp.collected = true
      sendWeaponCollected(weaponPickups.indexOf(wp))
      const wpDef = WEAPONS[wp.type]
      state.playerAmmo[wp.type] += wpDef.ammo
      // Only switch to it if player doesn't already have it
      const hadWeapon = state.playerAmmo[wp.type] - wpDef.ammo > 0 || state.playerAmmo[wp.type] === -1
      if (!hadWeapon) state.currentWeapon = wp.type
      floatingTexts.push({
        x: player.x + player.w / 2, y: player.y - 15,
        text: `+${wpDef.name}`, color: wpDef.color,
        life: 1.0, maxLife: 1.0,
      })
      SFX.pickup()
    }
  }
}

export function updateHealthPickups(gameDt: number) {
  const { healthPickups, player, floatingTexts } = state

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
}

export function updateAmmoPickups(gameDt: number) {
  const { ammoPickups, player, floatingTexts } = state

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
      state.playerAmmo[ap.weaponType] = (state.playerAmmo[ap.weaponType] === -1 ? 0 : state.playerAmmo[ap.weaponType]) + ap.amount
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
}

export function spawnWeaponPickups() {
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
    state.weaponPickups.push({
      x: spot.pos.x, y: spot.pos.y,
      w: 20, h: 14,
      type: spot.type,
      bobTimer: Math.random() * Math.PI * 2,
      collected: false,
    })
  }
}
