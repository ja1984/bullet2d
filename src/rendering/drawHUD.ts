// ─── Draw HUD ────────────────────────────────────────────────────────────────

import type { WeaponType } from '../types'
import { CANVAS_W, CANVAS_H, PLAYER_MAX_HP, BULLET_TIME_MAX, WEAPONS } from '../constants'
import { state } from '../state'
import { weaponSprites } from '../sprites/weaponSprites'

export function drawHUD() {
  const ctx = state.ctx!
  const { player, killCount, comboCount, wave, totalScore, waveState, waveTimer,
          gameOver, gameState, highScore, gameTime, killCamActive, screenFlashTimer,
          screenFlash, baseCameraZoom, camera } = state

  // ── Circular HP ring (top-left) ──
  const ringX = 50
  const ringY = 50
  const ringR = 28
  const ringW = 5
  const hpRatio = Math.max(0, player.hp / PLAYER_MAX_HP)
  const hpColor = hpRatio > 0.5 ? '#44aa55' : hpRatio > 0.25 ? '#ddaa22' : '#dd3333'

  // Background ring
  ctx.beginPath()
  ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = ringW
  ctx.stroke()

  // HP arc (clockwise from top)
  if (hpRatio > 0) {
    ctx.beginPath()
    ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio)
    ctx.strokeStyle = hpColor
    ctx.lineWidth = ringW
    ctx.stroke()
  }

  // HP text in center
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.ceil(player.hp)}`, ringX, ringY + 5)
  ctx.textAlign = 'left'

  // HP label
  ctx.fillStyle = '#888'
  ctx.font = '8px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('HP', ringX, ringY + 16)
  ctx.textAlign = 'left'

  // ── Bullet Time ring (inner ring inside HP) ──
  const btR = ringR - ringW - 3
  const btW = 3
  const btRatio = player.bulletTimeEnergy / BULLET_TIME_MAX
  const btColor = player.bulletTimeActive ? '#ff6644' : '#4488ff'

  // Background ring
  ctx.beginPath()
  ctx.arc(ringX, ringY, btR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = btW
  ctx.stroke()

  // BT arc
  if (btRatio > 0) {
    ctx.beginPath()
    ctx.arc(ringX, ringY, btR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * btRatio)
    ctx.strokeStyle = btColor
    ctx.lineWidth = btW
    ctx.stroke()
  }

  // ── Bottom weapon bar ──
  const allWeapons: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper', 'grenades']
  const slotW = 70
  const slotH = 48
  const slotGap = 6
  const totalBarW = allWeapons.length * slotW + (allWeapons.length - 1) * slotGap
  const barX = (CANVAS_W - totalBarW) / 2
  const barY = CANVAS_H - slotH - 12

  for (let i = 0; i < allWeapons.length; i++) {
    const w = allWeapons[i]
    const wpDef = WEAPONS[w]
    const hasAmmo = state.playerAmmo[w] === -1 || state.playerAmmo[w] > 0
    const isActive = w === state.currentWeapon
    const sx = barX + i * (slotW + slotGap)

    // Slot background
    ctx.fillStyle = isActive ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.4)'
    ctx.fillRect(sx, barY, slotW, slotH)

    // Active border
    if (isActive) {
      ctx.strokeStyle = wpDef.color
      ctx.lineWidth = 2
      ctx.strokeRect(sx, barY, slotW, slotH)
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.strokeRect(sx, barY, slotW, slotH)
    }

    // Weapon sprite icon
    const ws = weaponSprites[w]
    ctx.imageSmoothingEnabled = false
    if (ws?.loaded) {
      const iconH = 16
      const iconScale = iconH / ws.h
      const iconW = ws.w * iconScale
      ctx.globalAlpha = hasAmmo ? (isActive ? 1 : 0.6) : 0.2
      ctx.drawImage(ws.image, sx + slotW / 2 - iconW / 2, barY + 6, iconW, iconH)
      ctx.globalAlpha = 1
    }

    // Key number
    ctx.fillStyle = isActive ? '#fff' : '#666'
    ctx.font = '9px monospace'
    ctx.fillText(`${i + 1}`, sx + 3, barY + 12)

    // Ammo/mag info
    if (isActive) {
      if (player.reloading) {
        ctx.fillStyle = '#ff8844'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        const reloadPct = Math.floor((1 - player.reloadTimer / wpDef.reloadTime) * 100)
        ctx.fillText(`RELOAD ${reloadPct}%`, sx + slotW / 2, barY + slotH - 6)
        // Reload bar
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(sx + 2, barY + slotH - 3, (slotW - 4) * (reloadPct / 100), 2)
      } else {
        ctx.fillStyle = state.magRounds[w] <= Math.ceil(wpDef.magSize * 0.2) ? '#ff4444' : '#ccc'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        const totalAmmo = state.playerAmmo[w] === -1 ? '∞' : state.playerAmmo[w]
        ctx.fillText(`${state.magRounds[w]}|${totalAmmo}`, sx + slotW / 2, barY + slotH - 6)
      }
      ctx.textAlign = 'left'
    } else {
      // Inactive — show ammo count
      const ammo = state.playerAmmo[w]
      const ammoText = ammo === -1 ? '∞' : ammo.toString()
      ctx.fillStyle = hasAmmo ? '#555' : '#333'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(ammoText, sx + slotW / 2, barY + slotH - 6)
      ctx.textAlign = 'left'
    }
  }

  // Kill count
  ctx.fillStyle = '#cc4444'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(`KILLS: ${killCount}`, CANVAS_W - 140, 34)

  // Combo display
  if (comboCount >= 2) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = `bold ${16 + comboCount * 2}px monospace`
    ctx.fillText(`${comboCount}x COMBO`, CANVAS_W - 160, 58)
  }

  // Kill feed — right side of screen
  for (let i = 0; i < state.killFeed.length; i++) {
    const kf = state.killFeed[i]
    const alpha = Math.min(1, kf.life / 0.5) // fade out in last 0.5s
    ctx.globalAlpha = alpha
    ctx.fillStyle = kf.color
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(kf.text, CANVAS_W - 20, 80 + i * 22)
    ctx.textAlign = 'left'
  }
  ctx.globalAlpha = 1

  // Wave display
  ctx.fillStyle = '#aaa'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`WAVE ${wave}`, CANVAS_W / 2 - 30, 20)
  ctx.fillStyle = '#666'
  ctx.font = '10px monospace'
  ctx.fillText(`SCORE: ${totalScore}`, CANVAS_W / 2 - 30, 34)

  // Wave countdown
  if (waveState === 'countdown') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Audiowide, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave + 1}`, CANVAS_W / 2, CANVAS_H / 2 - 5)
    ctx.fillStyle = '#aaa'
    ctx.font = '18px monospace'
    ctx.fillText(`Starting in ${Math.ceil(waveTimer)}...`, CANVAS_W / 2, CANVAS_H / 2 + 25)
    ctx.textAlign = 'left'
  }

  // Wave cleared screen
  if (waveState === 'cleared') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, CANVAS_H / 2 - 60, CANVAS_W, 120)
    ctx.fillStyle = '#44ff44'
    ctx.font = 'bold 32px Audiowide, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave} CLEARED!`, CANVAS_W / 2, CANVAS_H / 2 - 20)
    ctx.fillStyle = '#fff'
    ctx.font = '16px monospace'
    ctx.fillText(`Kills: ${killCount}  |  Score: ${totalScore}`, CANVAS_W / 2, CANVAS_H / 2 + 10)
    ctx.fillStyle = '#88ff88'
    ctx.font = '12px monospace'
    ctx.fillText('+15 HP recovered', CANVAS_W / 2, CANVAS_H / 2 + 35)
    ctx.textAlign = 'left'
  }


  // Weapon wheel — hold Tab
  if (state.keys['Tab']) {
    const wcx = CANVAS_W / 2
    const wcy = CANVAS_H / 2
    const wheelR = 80

    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    for (let i = 0; i < allWeapons.length; i++) {
      const w = allWeapons[i]
      const angle = -Math.PI / 2 + (i / allWeapons.length) * Math.PI * 2
      const wx = wcx + Math.cos(angle) * wheelR
      const wy = wcy + Math.sin(angle) * wheelR
      const isActive = w === state.currentWeapon
      const hasAmmo = state.playerAmmo[w] === -1 || state.playerAmmo[w] > 0

      // Slot circle
      ctx.beginPath()
      ctx.arc(wx, wy, 28, 0, Math.PI * 2)
      ctx.fillStyle = isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)'
      ctx.fill()
      if (isActive) {
        ctx.strokeStyle = WEAPONS[w].color
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Weapon icon
      const ws = weaponSprites[w]
      if (ws?.loaded) {
        const iconH = 18
        const iconScale = iconH / ws.h
        const iconW = ws.w * iconScale
        ctx.globalAlpha = hasAmmo ? 1 : 0.3
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(ws.image, wx - iconW / 2, wy - iconH / 2 - 2, iconW, iconH)
        ctx.globalAlpha = 1
      }

      // Key + name
      ctx.fillStyle = isActive ? '#fff' : '#888'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${i + 1}`, wx, wy + 18)
      ctx.textAlign = 'left'
    }
  }

  // Bullet time overlay + cinematic bars
  if (player.bulletTimeActive) {
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.15)'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = 'rgba(255, 100, 50, 0.7)'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('● BULLET TIME', CANVAS_W / 2 - 60, 30)
  }

  // Screen flash border
  if (screenFlashTimer > 0 && screenFlash) {
    const borderW = 6
    ctx.fillStyle = screenFlash
    ctx.fillRect(0, 0, CANVAS_W, borderW)
    ctx.fillRect(0, CANVAS_H - borderW, CANVAS_W, borderW)
    ctx.fillRect(0, 0, borderW, CANVAS_H)
    ctx.fillRect(CANVAS_W - borderW, 0, borderW, CANVAS_H)
  }

  // Kill cam indicator
  if (killCamActive) {
    ctx.fillStyle = 'rgba(255, 200, 50, 0.6)'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('● LAST KILL', CANVAS_W / 2, CANVAS_H - 50)
    ctx.textAlign = 'left'
  }

  // Parallax foreground — subtle fog/debris
  ctx.globalAlpha = 0.04
  ctx.fillStyle = '#aabbcc'
  const fgParallax = camera.x * 1.3
  for (let i = 0; i < 8; i++) {
    const fx = i * 200 - fgParallax % 200 - 100
    const fy = 500 + Math.sin(gameTime * 0.3 + i * 1.7) * 30
    ctx.fillRect(fx, fy, 120 + Math.sin(i * 3.1) * 40, 3)
  }
  ctx.globalAlpha = 1

  // Damage vignette — red edges when low HP
  const hpPct = player.hp / PLAYER_MAX_HP
  if (hpPct < 0.4) {
    const vignetteAlpha = (1 - hpPct / 0.4) * 0.5
    const gradient = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.25,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
    )
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(150,0,0,${vignetteAlpha})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Pulse effect at very low HP
    if (hpPct < 0.2) {
      const pulse = Math.sin(gameTime * 4) * 0.1 + 0.1
      ctx.fillStyle = `rgba(255,0,0,${pulse})`
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }
  }


}

export function drawOverlays() {
  const ctx = state.ctx!
  const { gameOver, wave, killCount, totalScore, highScore, gameState } = state

  // Game over
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#ff3333'
    ctx.font = 'bold 48px Audiowide, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('WASTED', CANVAS_W / 2, CANVAS_H / 2 - 30)

    ctx.fillStyle = '#aaa'
    ctx.font = '18px monospace'
    ctx.fillText(`Wave: ${wave}  |  Kills: ${killCount}  |  Score: ${totalScore}`, CANVAS_W / 2, CANVAS_H / 2 + 10)

    ctx.fillStyle = highScore === totalScore && totalScore > 0 ? '#ffaa22' : '#888'
    ctx.font = '14px monospace'
    ctx.fillText(`High Score: ${highScore}${highScore === totalScore && totalScore > 0 ? ' ★ NEW!' : ''}`, CANVAS_W / 2, CANVAS_H / 2 + 35)

    ctx.fillStyle = '#666'
    ctx.font = '14px monospace'
    ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 65)
    ctx.textAlign = 'left'
  }

  // Pause menu
  if (gameState === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px Audiowide, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 40)
    ctx.fillStyle = '#aaa'
    ctx.font = '13px monospace'
    ctx.fillText('WASD — Move  |  Mouse — Aim & Shoot', CANVAS_W / 2, CANVAS_H / 2 + 0)
    ctx.fillText('Space — Bullet Time  |  S — Crouch', CANVAS_W / 2, CANVAS_H / 2 + 18)
    ctx.fillText('Double-tap A/D — Dive  |  Crouch + A/D — Roll', CANVAS_W / 2, CANVAS_H / 2 + 36)
    ctx.fillText('1/2/3/4 or Scroll — Weapons  |  R — Reload', CANVAS_W / 2, CANVAS_H / 2 + 54)
    ctx.fillText('F11 / Ctrl+F — Fullscreen', CANVAS_W / 2, CANVAS_H / 2 + 72)
    ctx.fillStyle = '#666'
    ctx.fillText('Press ESC to resume', CANVAS_W / 2, CANVAS_H / 2 + 100)
    ctx.textAlign = 'left'
  }
}
