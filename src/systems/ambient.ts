// ─── Ambient Environment ──────────────────────────────────────────────────────

import { platforms } from '../constants'
import { state } from '../state'

export function spawnAmbientObjects() {
  const groundY = 620

  // Steam vents — placed at fixed intervals along the ground
  state.steamVents.length = 0
  const ventSpots = [180, 480, 750, 1100, 1400, 1750, 2100]
  for (const vx of ventSpots) {
    if (Math.random() < 0.5) {
      state.steamVents.push({
        x: vx + (Math.random() - 0.5) * 40,
        y: groundY,
        timer: Math.random() * 3,
        interval: 2 + Math.random() * 3,
        active: false,
        burstTimer: 0,
      })
    }
  }

  // Puddles — random spots on the ground
  state.puddles.length = 0
  for (let i = 0; i < 10; i++) {
    const px = 100 + Math.random() * 2200
    state.puddles.push({
      x: px,
      y: groundY,
      w: 20 + Math.random() * 40,
    })
  }

  // Streetlights — spaced along the ground
  state.streetlights.length = 0
  const lightSpots = [250, 600, 950, 1300, 1650, 2000]
  for (const lx of lightSpots) {
    if (Math.random() < 0.6) {
      state.streetlights.push({
        x: lx + (Math.random() - 0.5) * 30,
        y: groundY,
        on: true,
        flickerTimer: Math.random() * 10,
      })
    }
  }

  // Pigeons — small groups on wider platforms
  state.pigeons.length = 0
  const widePlats = platforms.filter(p => p.h <= 20 && p.w >= 180 && p.y < groundY)
  for (const plat of widePlats) {
    if (Math.random() < 0.5) {
      const count = 2 + Math.floor(Math.random() * 3)
      for (let j = 0; j < count; j++) {
        state.pigeons.push({
          x: plat.x + 30 + Math.random() * (plat.w - 60),
          y: plat.y - 6,
          vx: 0,
          vy: 0,
          grounded: true,
          scattered: false,
          life: 999,
          peckTimer: Math.random() * 2,
        })
      }
    }
  }
  // Also some on the ground
  if (Math.random() < 0.7) {
    const gx = 400 + Math.random() * 1600
    const count = 3 + Math.floor(Math.random() * 3)
    for (let j = 0; j < count; j++) {
      state.pigeons.push({
        x: gx + (Math.random() - 0.5) * 80,
        y: groundY - 6,
        vx: 0,
        vy: 0,
        grounded: true,
        scattered: false,
        life: 999,
        peckTimer: Math.random() * 2,
      })
    }
  }

  // Helicopters — 1-2 drifting across the deep background
  state.helicopters.length = 0
  state.helicopters.push({
    x: -200 + Math.random() * 500,
    y: 40 + Math.random() * 80,
    vx: 15 + Math.random() * 10,
    blinkTimer: 0,
  })
  if (Math.random() < 0.5) {
    state.helicopters.push({
      x: 1400 + Math.random() * 400,
      y: 30 + Math.random() * 60,
      vx: -(12 + Math.random() * 8),
      blinkTimer: Math.random() * 2,
    })
  }
}

export function updateAmbient(dt: number, gameDt: number) {
  // Steam vents — no particles, just visual grate on ground

  // Streetlight flicker
  for (const sl of state.streetlights) {
    sl.flickerTimer += dt
    // Occasional flicker off/on
    const flick = Math.sin(sl.flickerTimer * 12 + sl.x * 0.1)
    sl.on = flick > -0.85 // mostly on, brief flickers off
  }

  // Pigeons — scatter when player gets close
  const player = state.player
  for (let i = state.pigeons.length - 1; i >= 0; i--) {
    const p = state.pigeons[i]
    if (p.grounded && !p.scattered) {
      // Peck animation timer
      p.peckTimer -= gameDt
      if (p.peckTimer <= 0) p.peckTimer = 1 + Math.random() * 2

      // Scatter if player is close
      const dx = player.x - p.x
      const dy = player.y - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 80) {
        p.scattered = true
        p.grounded = false
        p.vx = (Math.random() - 0.5) * 200 + (p.x > player.x ? 80 : -80)
        p.vy = -(200 + Math.random() * 150)
        p.life = 1.5 + Math.random() * 0.5
      }
    }

    if (p.scattered) {
      p.x += p.vx * gameDt
      p.y += p.vy * gameDt
      p.vy += 100 * gameDt // slight gravity, but they mostly fly up/away
      p.life -= gameDt
      if (p.life <= 0) {
        state.pigeons.splice(i, 1)
      }
    }
  }

  // Helicopters — drift across the screen, wrap around
  for (const h of state.helicopters) {
    h.x += h.vx * dt
    h.blinkTimer += dt
    // Wrap around
    if (h.vx > 0 && h.x > 2600) h.x = -200
    if (h.vx < 0 && h.x < -200) h.x = 2600
  }
}
