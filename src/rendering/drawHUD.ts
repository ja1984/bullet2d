// ─── Draw HUD ────────────────────────────────────────────────────────────────

import type { WeaponType } from '../types'
import { CANVAS_W, CANVAS_H, PLAYER_MAX_HP, BULLET_TIME_MAX, WEAPONS } from '../constants'
import { state } from '../state'

export function drawHUD() {
  const ctx = state.ctx!
  const { player, killCount, comboCount, wave, totalScore, waveState, waveTimer,
          gameOver, gameState, highScore, gameTime, killCamActive, screenFlashTimer,
          screenFlash, baseCameraZoom, camera } = state

  // HP bar
  ctx.fillStyle = '#222'
  ctx.fillRect(20, 20, 200, 16)
  const hpRatio = Math.max(0, player.hp / PLAYER_MAX_HP)
  ctx.fillStyle = hpRatio > 0.3 ? '#44aa55' : '#dd3333'
  ctx.fillRect(20, 20, 200 * hpRatio, 16)
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  ctx.strokeRect(20, 20, 200, 16)

  ctx.fillStyle = '#fff'
  ctx.font = '11px monospace'
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 24, 33)

  // Bullet time bar
  ctx.fillStyle = '#222'
  ctx.fillRect(20, 42, 200, 10)
  const btRatio = player.bulletTimeEnergy / BULLET_TIME_MAX
  ctx.fillStyle = player.bulletTimeActive ? '#ff6644' : '#4488ff'
  ctx.fillRect(20, 42, 200 * btRatio, 10)
  ctx.strokeStyle = '#555'
  ctx.strokeRect(20, 42, 200, 10)

  ctx.fillStyle = '#aaa'
  ctx.font = '10px monospace'
  ctx.fillText('BULLET TIME [SHIFT]', 24, 51)

  // Weapon display
  const wpDef = WEAPONS[state.currentWeapon]
  ctx.fillStyle = wpDef.color
  ctx.font = 'bold 14px monospace'
  ctx.fillText(wpDef.name, 20, 74)

  // Mag display
  if (player.reloading) {
    ctx.fillStyle = '#ff8844'
    ctx.font = 'bold 12px monospace'
    const reloadPct = Math.floor((1 - player.reloadTimer / wpDef.reloadTime) * 100)
    ctx.fillText(`RELOADING... ${reloadPct}%`, 20, 90)
  } else {
    const magColor = state.magRounds[state.currentWeapon] <= Math.ceil(wpDef.magSize * 0.2) ? '#ff4444' : '#aaa'
    ctx.fillStyle = magColor
    ctx.font = '12px monospace'
    ctx.fillText(`MAG: ${state.magRounds[state.currentWeapon]} / ${wpDef.magSize}`, 20, 90)
  }

  // Weapon slots
  const slotY = 100
  const allWeapons: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper']
  for (let i = 0; i < allWeapons.length; i++) {
    const w = allWeapons[i]
    const hasAmmo = state.playerAmmo[w] === -1 || state.playerAmmo[w] > 0
    const isActive = w === state.currentWeapon

    ctx.fillStyle = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'
    ctx.fillRect(20 + i * 56, slotY, 50, 20)
    if (isActive) {
      ctx.strokeStyle = WEAPONS[w].color
      ctx.lineWidth = 1
      ctx.strokeRect(20 + i * 56, slotY, 50, 20)
    }

    ctx.fillStyle = hasAmmo ? (isActive ? '#fff' : '#888') : '#333'
    ctx.font = '9px monospace'
    ctx.fillText(`${i + 1} ${WEAPONS[w].name}`, 24 + i * 56, slotY + 13)
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
    ctx.font = 'bold 32px monospace'
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
    ctx.font = 'bold 32px monospace'
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

  // Controls hint
  ctx.fillStyle = '#555'
  ctx.font = '11px monospace'
  ctx.fillText('WASD: Move | Double-tap A/D: Dive | Shift: Bullet Time | 1/2/3 or Scroll: Weapons | R: Reload', 20, CANVAS_H - 14)

  // Bullet time overlay
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

}

export function drawOverlays() {
  const ctx = state.ctx!
  const { gameOver, wave, killCount, totalScore, highScore, gameState } = state

  // Game over
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#ff3333'
    ctx.font = 'bold 48px monospace'
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
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 40)
    ctx.fillStyle = '#aaa'
    ctx.font = '14px monospace'
    ctx.fillText('WASD: Move  |  Mouse: Aim & Shoot  |  Shift: Bullet Time', CANVAS_W / 2, CANVAS_H / 2 + 5)
    ctx.fillText('Double-tap A/D: Dive  |  S: Crouch  |  1/2/3: Weapons  |  R: Reload', CANVAS_W / 2, CANVAS_H / 2 + 25)
    ctx.fillStyle = '#666'
    ctx.fillText('Press ESC to resume', CANVAS_W / 2, CANVAS_H / 2 + 60)
    ctx.textAlign = 'left'
  }
}
