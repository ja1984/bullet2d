// ─── Renderer ────────────────────────────────────────────────────────────────

import { CANVAS_W, CANVAS_H } from '../constants'
import { state } from '../state'
import { drawPlatforms, drawBloodDecals, drawCoverBoxes } from './drawLevel'
import { drawEnemies, drawPlayer } from './drawEntities'
import { drawBullets, drawParticles, drawShellCasings, drawHealthPickups, drawAmmoPickups, drawWeaponPickups, drawFloatingTexts, drawCrosshair } from './drawEffects'
import { drawHUD, drawOverlays } from './drawHUD'

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

  // Background city silhouette (parallax)
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
  drawBloodDecals()
  drawCoverBoxes()
  drawWeaponPickups()
  drawBullets()
  drawEnemies()
  drawPlayer()
  drawParticles()
  drawShellCasings()
  drawHealthPickups()
  drawAmmoPickups()
  drawFloatingTexts()
  drawCrosshair()

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
  ctx.font = '13px monospace'
  ctx.fillText('WASD: Move  |  Mouse: Aim & Shoot  |  Shift: Bullet Time', CANVAS_W / 2, CANVAS_H / 2 + 30)
  ctx.fillText('Double-tap A/D: Dive  |  S: Crouch  |  1/2/3: Weapons', CANVAS_W / 2, CANVAS_H / 2 + 50)

  // Start prompt
  const pulse = 0.5 + Math.sin(state.gameTime * 3) * 0.5
  ctx.globalAlpha = 0.5 + pulse * 0.5
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('Click to Start', CANVAS_W / 2, CANVAS_H / 2 + 100)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}
