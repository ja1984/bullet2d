// ─── Renderer ────────────────────────────────────────────────────────────────

import { CANVAS_W, CANVAS_H, PLAYER_SKINS } from '../constants'
import type { PlayerSkin } from '../constants'
import { state } from '../state'
import { drawPlatforms, drawBloodDecals, drawCoverBoxes, drawSteamVents, drawPuddles, drawStreetlights, drawPigeons } from './drawLevel'
import { drawEnemies, drawPlayer } from './drawEntities'
import { drawBullets, drawParticles, drawShellCasings, drawHealthPickups, drawAmmoPickups, drawWeaponPickups, drawFloatingTexts, drawCrosshair, drawGrenades } from './drawEffects'
import { drawHUD, drawOverlays } from './drawHUD'
import { playerSprites } from '../sprites/playerSprites'

let reflectionCanvas: HTMLCanvasElement | null = null

const carImg = new Image()
carImg.src = 'sprites/other/car.png'



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

  // Thunder flash
  if (state.thunderFlash > 0) {
    ctx.globalAlpha = state.thunderFlash * 1.5
    ctx.fillStyle = '#ccccff'
    ctx.fillRect(camera.x, camera.y, CANVAS_W, CANVAS_H)
    ctx.globalAlpha = 1
  }

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

  // Ground
  const groundY = 620
  ctx.fillStyle = '#2a2a3e'
  ctx.fillRect(0, groundY, CANVAS_W, 100)
  ctx.fillStyle = '#4a4a6e'
  ctx.fillRect(0, groundY, CANVAS_W, 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, groundY, 2, 100)
  ctx.fillRect(CANVAS_W - 2, groundY, 2, 100)

  // Streetlights on ground
  for (let i = 0; i < 4; i++) {
    const sx = 200 + i * 300
    ctx.fillStyle = '#333344'
    ctx.fillRect(sx - 2, groundY - 70, 4, 70)
    ctx.fillRect(sx - 1, groundY - 70, 12, 3)
    ctx.fillStyle = '#444455'
    ctx.fillRect(sx + 6, groundY - 70, 8, 5)
    const flicker = Math.sin(state.gameTime * 12 + i * 3.5) > -0.85 ? 1 : 0
    if (flicker) {
      ctx.fillStyle = '#ffcc66'
      ctx.fillRect(sx + 7, groundY - 67, 6, 2)
      ctx.globalAlpha = 0.06
      const grad = ctx.createRadialGradient(sx + 10, groundY, 0, sx + 10, groundY, 70)
      grad.addColorStop(0, '#ffcc66')
      grad.addColorStop(1, 'rgba(255,204,102,0)')
      ctx.fillStyle = grad
      ctx.fillRect(sx - 60, groundY - 70, 140, 80)
      ctx.globalAlpha = 1
    }
  }

  // Parked car on the ground
  if (carImg.complete && carImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false
    const carScale = 0.6
    const carW = carImg.naturalWidth * carScale
    const carH = carImg.naturalHeight * carScale
    ctx.drawImage(carImg, 160, groundY - carH + 4, carW, carH)

    // Player standing by the car
    const idleAnim = playerSprites?.idle
    const idleFrame = idleAnim?.loaded ? idleAnim.frames[Math.floor(state.gameTime * 6) % idleAnim.frames.length] : null
    if (idleFrame?.complete && idleFrame.naturalWidth > 0) {
      const playerScale = 1
      const pw = 68 * playerScale
      const ph = 68 * playerScale
      ctx.drawImage(idleFrame, 160 + carW - 20, groundY - ph + 10, pw, ph)
    }
  }

  // Drones patrolling
  for (let d = 0; d < 3; d++) {
    const speed = 30 + d * 15
    const dx = ((state.gameTime * speed + d * 500) % (CANVAS_W + 200)) - 100
    const dy = 120 + d * 80 + Math.sin(state.gameTime * 2 + d * 2) * 10
    // Body
    ctx.fillStyle = '#556677'
    ctx.fillRect(dx - 7, dy - 4, 14, 8)
    // Eye
    ctx.fillStyle = d % 2 === 0 ? '#ff4444' : '#44ffaa'
    ctx.fillRect(dx - 2, dy - 2, 4, 3)
    // Propeller arms
    ctx.fillStyle = '#445566'
    ctx.fillRect(dx - 10, dy - 6, 20, 2)
    // Spinning propellers
    const spin = Math.sin(state.gameTime * 30 + d * 7) * 4
    ctx.fillStyle = '#88aabb'
    ctx.fillRect(dx - 10 + spin, dy - 8, 3, 2)
    ctx.fillRect(dx + 7 - spin, dy - 8, 3, 2)
    // Searchlight cone
    ctx.globalAlpha = 0.03
    ctx.beginPath()
    ctx.moveTo(dx, dy + 4)
    ctx.lineTo(dx - 20, groundY)
    ctx.lineTo(dx + 20, groundY)
    ctx.closePath()
    ctx.fillStyle = d % 2 === 0 ? '#ff6644' : '#44ffaa'
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Rain
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#8899bb'
  ctx.lineWidth = 1
  for (let i = 0; i < 40; i++) {
    const rx = ((state.gameTime * 200 + i * 97) % (CANVAS_W + 40)) - 20
    const ry = ((state.gameTime * (400 + i * 5) + i * 137) % (groundY + 20)) - 10
    if (ry < groundY - 5) {
      ctx.beginPath()
      ctx.moveTo(rx, ry)
      ctx.lineTo(rx + 2, Math.min(ry + 8 + (i % 4) * 2, groundY))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // Title
  ctx.fillStyle = '#ff3333'
  ctx.font = 'bold 52px Audiowide, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('BULLET', CANVAS_W / 2, CANVAS_H / 2 - 80)
  ctx.fillStyle = '#ffc832'
  ctx.font = 'bold 28px Audiowide, monospace'
  ctx.fillText('2 D', CANVAS_W / 2, CANVAS_H / 2 - 45)

  // High scores leaderboard
  if (state.highScores.length > 0) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = 'bold 12px Audiowide, monospace'
    ctx.fillText('TOP SCORES', CANVAS_W / 2, CANVAS_H / 2 - 8)
    ctx.font = '10px monospace'
    for (let i = 0; i < Math.min(5, state.highScores.length); i++) {
      const hs = state.highScores[i]
      const y = CANVAS_H / 2 + 10 + i * 15
      ctx.fillStyle = i === 0 ? '#ffcc44' : '#888'
      ctx.fillText(`${i + 1}. ${hs.score}  W${hs.wave}  ${hs.kills}K  ${hs.date}`, CANVAS_W / 2, y)
    }
  }

  // Controls
  const controlsY = state.highScores.length > 0 ? CANVAS_H / 2 + 90 : CANVAS_H / 2 + 20
  ctx.fillStyle = '#888'
  ctx.font = '12px monospace'
  ctx.fillText('WASD — Move  |  Mouse — Aim & Shoot', CANVAS_W / 2, controlsY)
  ctx.fillText('Space — Bullet Time  |  S — Crouch', CANVAS_W / 2, controlsY + 18)
  ctx.fillText('Double-tap A/D — Dive  |  Crouch + A/D — Roll', CANVAS_W / 2, controlsY + 36)
  ctx.fillText('1/2/3/4 or Scroll — Weapons  |  R — Reload', CANVAS_W / 2, controlsY + 54)

  // Skin selector
  const skinIds = Object.keys(PLAYER_SKINS) as PlayerSkin[]
  const currentSkin = PLAYER_SKINS[state.playerSkin]
  ctx.fillStyle = '#aaa'
  ctx.font = '11px monospace'
  ctx.fillText(`Skin: ${currentSkin.name}  [← →]`, CANVAS_W / 2, controlsY + 76)

  // Start prompt
  const pulse = 0.5 + Math.sin(state.gameTime * 3) * 0.5
  ctx.globalAlpha = 0.5 + pulse * 0.5
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('Click to Start', CANVAS_W / 2, controlsY + 100)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}
