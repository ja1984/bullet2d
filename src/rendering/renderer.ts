// ─── Renderer ────────────────────────────────────────────────────────────────

import { CANVAS_W, CANVAS_H } from '../constants'
import { state } from '../state'
import { drawPlatforms, drawBloodDecals, drawCoverBoxes, drawSteamVents, drawPuddles, drawStreetlights, drawPigeons } from './drawLevel'
import { drawEnemies, drawPlayer } from './drawEntities'
import { drawBullets, drawParticles, drawShellCasings, drawHealthPickups, drawAmmoPickups, drawWeaponPickups, drawFloatingTexts, drawCrosshair, drawGrenades } from './drawEffects'
import { drawHUD, drawOverlays } from './drawHUD'

let reflectionCanvas: HTMLCanvasElement | null = null


export function render() {
  const ctx = state.ctx!
  const { camera, player, screenShake, baseCameraZoom } = state

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

  // Deep parallax layer — distant skyscrapers
  ctx.fillStyle = '#0d0d1a'
  const deepParallax = camera.x * 0.1
  for (let i = 0; i < 12; i++) {
    const bx = i * 240 - deepParallax % 240 - 240
    const bh = 160 + Math.sin(i * 1.9) * 100 + Math.cos(i * 3.1) * 60
    ctx.fillRect(bx, CANVAS_H - bh - 100, 180, bh + 100)
    // Distant windows — sparse, dim
    ctx.fillStyle = '#14142a'
    for (let wy = CANVAS_H - bh - 80; wy < CANVAS_H - 100; wy += 30) {
      for (let wx = bx + 20; wx < bx + 165; wx += 35) {
        if (Math.sin(i * 7.3 + wx * 0.1 + wy * 0.05) > 0.2) ctx.fillRect(wx, wy, 10, 12)
      }
    }
    // Neon signs — occasional colored glows on building faces
    const neonSeed = Math.sin(i * 5.7) * 10000
    if ((neonSeed | 0) % 3 === 0) {
      const neonColors = ['rgba(255,40,80,', 'rgba(0,200,255,', 'rgba(255,180,30,']
      const neonColor = neonColors[(i * 3 + 1) % neonColors.length]
      const nx = bx + 40 + ((i * 37) % 80)
      const ny = CANVAS_H - bh - 40
      // Flicker effect
      const flicker = Math.sin(state.gameTime * 8 + i * 4.2) > -0.3 ? 1 : 0.2
      // Sign body
      ctx.fillStyle = neonColor + (0.6 * flicker).toFixed(2) + ')'
      ctx.fillRect(nx, ny, 30 + (i % 3) * 10, 8)
      // Glow
      ctx.fillStyle = neonColor + (0.08 * flicker).toFixed(2) + ')'
      ctx.fillRect(nx - 10, ny - 10, 50 + (i % 3) * 10, 28)
    }
    ctx.fillStyle = '#0d0d1a'
  }

  // Helicopters — tiny silhouettes in deep background
  for (const h of state.helicopters) {
    const hx = h.x - deepParallax * 0.5
    const hy = h.y
    ctx.fillStyle = '#0a0a15'
    // Body
    ctx.fillRect(hx - 6, hy - 2, 12, 4)
    // Tail
    ctx.fillRect(hx + (h.vx > 0 ? -14 : 6), hy - 1, 8, 2)
    // Rotor — spinning blur
    ctx.globalAlpha = 0.4
    ctx.fillStyle = '#0a0a15'
    const rotorW = Math.abs(Math.sin(state.gameTime * 30)) * 16
    ctx.fillRect(hx - rotorW, hy - 4, rotorW * 2, 1)
    ctx.globalAlpha = 1
    // Blinking light
    if (Math.sin(h.blinkTimer * 4) > 0.6) {
      ctx.fillStyle = '#ff2222'
      ctx.fillRect(hx, hy - 3, 2, 2)
    }
  }

  // Graffiti / wanted posters on deep buildings
  for (let i = 0; i < 12; i++) {
    const bx = i * 240 - deepParallax % 240 - 240
    const bh = 160 + Math.sin(i * 1.9) * 100 + Math.cos(i * 3.1) * 60
    const seed = Math.sin(i * 13.7) * 10000
    if ((seed | 0) % 4 === 0) {
      const gx = bx + 30 + ((i * 47) % 100)
      const gy = CANVAS_H - bh / 2 - 40
      // Poster rectangle
      ctx.globalAlpha = 0.15
      ctx.fillStyle = ((seed | 0) % 2 === 0) ? '#aa6633' : '#886644'
      ctx.fillRect(gx, gy, 18, 22)
      // "Text" lines
      ctx.fillStyle = '#554433'
      ctx.fillRect(gx + 3, gy + 14, 12, 1)
      ctx.fillRect(gx + 3, gy + 17, 8, 1)
      ctx.globalAlpha = 1
    }
    // Graffiti tags
    if ((seed | 0) % 5 === 1) {
      const gx = bx + 60 + ((i * 31) % 80)
      const gy = CANVAS_H - 130
      ctx.globalAlpha = 0.1
      const grafColors = ['#ff4466', '#44ccff', '#88ff44', '#ffaa22']
      ctx.fillStyle = grafColors[i % grafColors.length]
      ctx.fillRect(gx, gy, 24 + (i % 3) * 8, 6)
      ctx.fillRect(gx + 4, gy + 6, 16, 4)
      ctx.globalAlpha = 1
    }
  }

  // Fog/smog band between layers
  const fogGrad = ctx.createLinearGradient(0, CANVAS_H - 350, 0, CANVAS_H - 150)
  fogGrad.addColorStop(0, 'rgba(15,15,35,0)')
  fogGrad.addColorStop(0.4, 'rgba(20,18,40,0.4)')
  fogGrad.addColorStop(0.6, 'rgba(25,22,50,0.5)')
  fogGrad.addColorStop(1, 'rgba(15,15,35,0)')
  ctx.fillStyle = fogGrad
  ctx.fillRect(0, CANVAS_H - 350, CANVAS_W, 200)

  // Foreground city silhouette (parallax)
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

  drawPlatforms()
  drawSteamVents()
  drawStreetlights()
  drawPuddles()

  // Wet floor reflection — render to offscreen canvas then composite
  const groundY = 620
  if (!reflectionCanvas) {
    reflectionCanvas = document.createElement('canvas')
    reflectionCanvas.width = 2400 // full level width
    reflectionCanvas.height = CANVAS_H
  }
  const rCtx = reflectionCanvas.getContext('2d')!
  rCtx.clearRect(0, 0, 2400, CANVAS_H)
  const origCtx = state.ctx!
  state.ctx = rCtx
  rCtx.save()
  // Draw entities flipped around groundY in world space
  rCtx.translate(0, groundY)
  rCtx.scale(1, -1)
  rCtx.translate(0, -groundY + 8)
  drawEnemies()
  drawPlayer()
  rCtx.restore()
  state.ctx = origCtx
  // Draw the offscreen canvas into the world (we're already in camera-transformed space)
  ctx.globalAlpha = 0.06
  ctx.drawImage(reflectionCanvas, camera.x, 0, CANVAS_W, CANVAS_H, camera.x, 0, CANVAS_W, CANVAS_H)
  ctx.globalAlpha = 1

  drawBloodDecals()
  drawCoverBoxes()
  drawWeaponPickups()
  drawBullets()
  drawGrenades()
  drawEnemies()
  drawPlayer()
  drawParticles()
  drawShellCasings()
  drawHealthPickups()
  drawAmmoPickups()
  drawFloatingTexts()
  drawCrosshair()
  drawPigeons()

  // Dynamic lighting — radial glow from muzzle flashes and explosions
  ctx.globalCompositeOperation = 'lighter'
  for (const lf of state.lightFlashes) {
    const radius = 80 * lf.intensity
    const gradient = ctx.createRadialGradient(lf.x, lf.y, 0, lf.x, lf.y, radius)
    gradient.addColorStop(0, lf.color + (lf.intensity * 0.3).toFixed(2) + ')')
    gradient.addColorStop(1, lf.color + '0)')
    ctx.fillStyle = gradient
    ctx.fillRect(lf.x - radius, lf.y - radius, radius * 2, radius * 2)
  }
  ctx.globalCompositeOperation = 'source-over'

  // Rain (in world space)
  ctx.globalAlpha = 0.15
  ctx.strokeStyle = '#8899bb'
  ctx.lineWidth = 1
  for (const r of state.raindrops) {
    ctx.beginPath()
    ctx.moveTo(r.x, r.y)
    ctx.lineTo(r.x + 2, r.y + r.length)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  ctx.restore() // camera

  drawHUD()

  ctx.restore() // shake

  // Draw overlays outside of shake transform so text is stable
  drawOverlays()
}

export function renderTitleScreen() {
  const ctx = state.ctx!

  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  gradient.addColorStop(0, '#0a0a1a')
  gradient.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Deep skyscrapers
  ctx.fillStyle = '#0d0d1a'
  for (let i = 0; i < 8; i++) {
    const bx = i * 190 + 10
    const bh = 160 + Math.sin(i * 1.9) * 100
    ctx.fillRect(bx, CANVAS_H - bh - 100, 140, bh + 100)
    // Distant windows
    ctx.fillStyle = '#14142a'
    for (let wy = CANVAS_H - bh - 80; wy < CANVAS_H - 100; wy += 30) {
      for (let wx = bx + 20; wx < bx + 125; wx += 35) {
        if (Math.sin(i * 7.3 + wx * 0.1 + wy * 0.05) > 0.2) ctx.fillRect(wx, wy, 10, 12)
      }
    }
    // Neon signs
    if (i % 3 === 0) {
      const neonColors = ['rgba(255,40,80,', 'rgba(0,200,255,', 'rgba(255,180,30,']
      const nc = neonColors[i % neonColors.length]
      const nx = bx + 30 + (i * 17) % 60
      const ny = CANVAS_H - bh - 40
      const flicker = Math.sin(state.gameTime * 8 + i * 4.2) > -0.3 ? 1 : 0.2
      ctx.fillStyle = nc + (0.6 * flicker).toFixed(2) + ')'
      ctx.fillRect(nx, ny, 35, 8)
      ctx.fillStyle = nc + (0.08 * flicker).toFixed(2) + ')'
      ctx.fillRect(nx - 10, ny - 10, 55, 28)
    }
    ctx.fillStyle = '#0d0d1a'
  }

  // Fog band
  const fogGrad = ctx.createLinearGradient(0, CANVAS_H - 350, 0, CANVAS_H - 150)
  fogGrad.addColorStop(0, 'rgba(15,15,35,0)')
  fogGrad.addColorStop(0.5, 'rgba(20,18,40,0.4)')
  fogGrad.addColorStop(1, 'rgba(15,15,35,0)')
  ctx.fillStyle = fogGrad
  ctx.fillRect(0, CANVAS_H - 350, CANVAS_W, 200)

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
  if (state.highScore > 0) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = '14px monospace'
    ctx.fillText(`High Score: ${state.highScore}`, CANVAS_W / 2, CANVAS_H / 2 - 10)
  }

  // Controls
  ctx.fillStyle = '#888'
  ctx.font = '12px monospace'
  ctx.fillText('WASD — Move  |  Mouse — Aim & Shoot', CANVAS_W / 2, CANVAS_H / 2 + 20)
  ctx.fillText('Space — Bullet Time  |  S — Crouch', CANVAS_W / 2, CANVAS_H / 2 + 38)
  ctx.fillText('Double-tap A/D — Dive  |  Crouch + A/D — Roll', CANVAS_W / 2, CANVAS_H / 2 + 56)
  ctx.fillText('1/2/3/4 or Scroll — Weapons  |  R — Reload', CANVAS_W / 2, CANVAS_H / 2 + 74)

  // Start prompt
  const pulse = 0.5 + Math.sin(state.gameTime * 3) * 0.5
  ctx.globalAlpha = 0.5 + pulse * 0.5
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('Click to Start', CANVAS_W / 2, CANVAS_H / 2 + 100)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}
