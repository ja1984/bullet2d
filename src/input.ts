// ─── Input ───────────────────────────────────────────────────────────────────

import type { WeaponType } from './types'
import { CANVAS_W, CANVAS_H } from './constants'
import { state } from './state'

export function getAvailableWeapons(): WeaponType[] {
  const all: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper']
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
    if (e.code === 'Space') e.preventDefault()
    if (e.code === 'Escape' && state.gameState === 'playing') {
      state.gameState = 'paused'
    } else if (e.code === 'Escape' && state.gameState === 'paused') {
      state.gameState = 'playing'
    }
    if (e.code === 'F11' || (e.code === 'KeyF' && e.ctrlKey)) {
      e.preventDefault()
      if (!document.fullscreenElement) {
        canvas.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  })
  window.addEventListener('keyup', (e) => { state.keys[e.code] = false })
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect()
    state.mouse.x = (e.clientX - rect.left) * (CANVAS_W / rect.width)
    state.mouse.y = (e.clientY - rect.top) * (CANVAS_H / rect.height)
  })
  canvas.addEventListener('mousedown', () => {
    state.mouseDown = true; state.mouseClicked = true
    if (state.gameState === 'title') { state.gameState = 'playing' }
  })
  canvas.addEventListener('mouseup', () => { state.mouseDown = false })

  // Weapon switching with number keys and scroll
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') switchWeapon('pistol')
    if (e.code === 'Digit2' && state.playerAmmo.shotgun > 0) switchWeapon('shotgun')
    if (e.code === 'Digit3' && state.playerAmmo.m16 > 0) switchWeapon('m16')
    if (e.code === 'Digit4' && state.playerAmmo.sniper > 0) switchWeapon('sniper')
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
