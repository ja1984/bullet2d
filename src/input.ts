// ─── Input ───────────────────────────────────────────────────────────────────

import type { WeaponType } from './types'
import type { PlayerSkin } from './constants'
import { CANVAS_W, CANVAS_H, PLAYER_SKINS } from './constants'
import { state } from './state'
import { SFX } from './audio'
import { setSkin } from './sprites/playerSprites'
import { sendPause, isHost } from './systems/network'

export function getAvailableWeapons(): WeaponType[] {
  const all: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper', 'grenades']
  return all.filter(w => state.playerAmmo[w] === -1 || state.playerAmmo[w] > 0)
}

export function switchWeapon(w: WeaponType) {
  if (w === state.currentWeapon) return
  if (state.playerAmmo[w] === 0) return
  state.currentWeapon = w
  state.player.reloading = false
  state.player.reloadTimer = 0
}

export function setupInput(canvas: HTMLCanvasElement) {
  window.addEventListener('keydown', (e) => {
    state.keys[e.code] = true
    if (e.code === 'Space' || e.code === 'Tab') { e.preventDefault(); e.stopPropagation() }
    // Skin cycling on title screen
    if (state.gameState === 'title' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      const skinIds = Object.keys(PLAYER_SKINS) as PlayerSkin[]
      const idx = skinIds.indexOf(state.playerSkin)
      const next = e.code === 'ArrowRight'
        ? skinIds[(idx + 1) % skinIds.length]
        : skinIds[(idx - 1 + skinIds.length) % skinIds.length]
      setSkin(next)
    }
    if (e.code === 'Escape' && state.gameState === 'playing') {
      state.gameState = 'paused'
      if (state.coopEnabled && isHost()) sendPause(true)
    } else if (e.code === 'Escape' && state.gameState === 'paused') {
      state.gameState = 'playing'
      if (state.coopEnabled && isHost()) sendPause(false)
    }
    if (e.code === 'F11' || (e.code === 'KeyF' && e.ctrlKey)) {
      e.preventDefault()
      if (!document.fullscreenElement) {
        canvas.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  }, { capture: true })
  window.addEventListener('keyup', (e) => { state.keys[e.code] = false })
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect()
    state.mouse.x = (e.clientX - rect.left) * (CANVAS_W / rect.width)
    state.mouse.y = (e.clientY - rect.top) * (CANVAS_H / rect.height)
  })
  canvas.addEventListener('mousedown', () => {
    state.mouseDown = true; state.mouseClicked = true
    if (state.gameState === 'title') { state.gameState = 'playing'; SFX.startAmbient() }
  })
  canvas.addEventListener('mouseup', () => { state.mouseDown = false })

  // Weapon switching with number keys and scroll
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') switchWeapon('pistol')
    if (e.code === 'Digit2' && state.playerAmmo.shotgun > 0) switchWeapon('shotgun')
    if (e.code === 'Digit3' && state.playerAmmo.m16 > 0) switchWeapon('m16')
    if (e.code === 'Digit4' && state.playerAmmo.sniper > 0) switchWeapon('sniper')
    if (e.code === 'Digit5' && state.playerAmmo.grenades > 0) switchWeapon('grenades')
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const available = getAvailableWeapons()
    if (available.length <= 1) return
    const idx = available.indexOf(state.currentWeapon)
    const next = e.deltaY > 0
      ? available[(idx + 1) % available.length]
      : available[(idx - 1 + available.length) % available.length]
    switchWeapon(next)
  }, { passive: false })
}
