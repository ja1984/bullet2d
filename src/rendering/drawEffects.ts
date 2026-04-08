// ─── Draw Effects ────────────────────────────────────────────────────────────

import { WEAPONS } from '../constants'
import { state } from '../state'
import { weaponSprites } from '../sprites/weaponSprites'

export function drawBullets() {
  const ctx = state.ctx!

  for (const b of state.bullets) {
    ctx.strokeStyle = b.owner === 'player' ? 'rgba(255,200,50,0.4)' : 'rgba(255,80,80,0.4)'
    ctx.lineWidth = 2
    if (b.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(b.trail[0].x, b.trail[0].y)
      for (let j = 1; j < b.trail.length; j++) {
        ctx.lineTo(b.trail[j].x, b.trail[j].y)
      }
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.fillStyle = b.owner === 'player' ? '#ffc832' : '#ff5555'
    ctx.beginPath()
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
    ctx.fill()

    if (state.player.bulletTimeActive) {
      ctx.fillStyle = b.owner === 'player' ? 'rgba(255,200,50,0.3)' : 'rgba(255,80,80,0.3)'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function drawParticles() {
  const ctx = state.ctx!

  for (const p of state.particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

export function drawShellCasings() {
  const ctx = state.ctx!

  for (const s of state.shellCasings) {
    ctx.globalAlpha = Math.min(1, s.life)
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.rotation)
    ctx.fillStyle = '#cc9933'
    ctx.fillRect(-2, -1, 4, 2)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

export function drawHealthPickups() {
  const ctx = state.ctx!

  for (const hp of state.healthPickups) {
    const bob = Math.sin(hp.bobTimer) * (hp.onGround ? 3 : 0)
    ctx.fillStyle = '#44ff44'
    ctx.fillRect(hp.x - 5, hp.y - 5 + bob, 12, 12)
    ctx.fillStyle = '#22aa22'
    ctx.fillRect(hp.x - 1, hp.y - 3 + bob, 4, 8)
    ctx.fillRect(hp.x - 3, hp.y - 1 + bob, 8, 4)
  }
}

export function drawAmmoPickups() {
  const ctx = state.ctx!

  for (const ap of state.ammoPickups) {
    const bob = Math.sin(ap.bobTimer) * (ap.onGround ? 3 : 0)
    const color = WEAPONS[ap.weaponType].color
    ctx.fillStyle = color
    ctx.fillRect(ap.x - 6, ap.y - 4 + bob, 12, 8)
    ctx.fillStyle = '#222'
    ctx.fillRect(ap.x - 4, ap.y - 2 + bob, 8, 4)
    ctx.fillStyle = color
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(WEAPONS[ap.weaponType].name, ap.x, ap.y - 7 + bob)
    ctx.textAlign = 'left'
  }
}

export function drawWeaponPickups() {
  const ctx = state.ctx!

  for (const wp of state.weaponPickups) {
    if (wp.collected) continue
    const bob = Math.sin(wp.bobTimer) * 4
    const wpDef = WEAPONS[wp.type]
    const ws = weaponSprites[wp.type]
    const wx = wp.x
    const wy = wp.y + bob

    // Glow
    ctx.fillStyle = wpDef.color + '22'
    ctx.beginPath()
    ctx.arc(wx + wp.w / 2, wy + wp.h / 2, 18, 0, Math.PI * 2)
    ctx.fill()

    // Weapon sprite or fallback
    ctx.imageSmoothingEnabled = false
    if (ws?.loaded) {
      const pickupScale = 20 / ws.h
      const drawW = ws.w * pickupScale
      const drawH = ws.h * pickupScale
      ctx.drawImage(ws.image, wx + wp.w / 2 - drawW / 2, wy + wp.h / 2 - drawH / 2, drawW, drawH)
    } else {
      ctx.fillStyle = wpDef.color
      ctx.fillRect(wx, wy, wp.w, wp.h)
    }

    // Label
    ctx.fillStyle = wpDef.color
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(wpDef.name, wx + wp.w / 2, wy - 6)
    ctx.textAlign = 'left'
  }
}

export function drawFloatingTexts() {
  const ctx = state.ctx!

  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = ft.life / ft.maxLife
    ctx.fillStyle = ft.color
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.textAlign = 'left'
  }
  ctx.globalAlpha = 1
}

export function drawCrosshair() {
  const ctx = state.ctx!
  const { player, mouse, camera, hitMarkerTimer } = state

  const aimWorldX = mouse.x + camera.x
  const aimWorldY = mouse.y + camera.y

  const crossColor = hitMarkerTimer > 0 ? '#ff4444' : (player.bulletTimeActive ? '#ff6644' : '#ffffff')
  ctx.strokeStyle = crossColor
  ctx.lineWidth = 1.5
  const crossX = aimWorldX
  const crossY = aimWorldY
  ctx.beginPath()
  ctx.arc(crossX, crossY, 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(crossX - 15, crossY); ctx.lineTo(crossX - 6, crossY)
  ctx.moveTo(crossX + 6, crossY); ctx.lineTo(crossX + 15, crossY)
  ctx.moveTo(crossX, crossY - 15); ctx.lineTo(crossX, crossY - 6)
  ctx.moveTo(crossX, crossY + 6); ctx.lineTo(crossX, crossY + 15)
  ctx.stroke()
}
