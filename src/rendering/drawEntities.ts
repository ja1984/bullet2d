// ─── Draw Entities ───────────────────────────────────────────────────────────

import type { EnemyBehavior, WeaponType } from '../types'
import { WEAPONS, spriteConfig, ARM_ANCHOR_X, ARM_ANCHOR_Y, ARM_PIVOT_X, ARM_PIVOT_Y, ARM_HAND_X, ARM_HAND_Y, SPRITE_FRAME_SIZE, platforms, GRAVITY, GRENADE_BOUNCE_DAMP } from '../constants'
import { state } from '../state'
import { playerSprites, getPlayerAnim, drawSprite } from '../sprites/playerSprites'
import { drawEnemySprite } from '../sprites/enemySprites'
import { weaponSprites } from '../sprites/weaponSprites'

export function drawEnemies() {
  const ctx = state.ctx!
  const { enemies, player } = state

  for (const e of enemies) {
    if (e.state === 'dead' && e.deathTimer <= 0) continue

    // Only fade during the last 2 seconds (after death animation finishes)
    const alpha = e.state === 'dead' ? Math.max(0, Math.min(1, e.deathTimer / 2)) : 1
    ctx.globalAlpha = alpha

    if (e.behavior === 'drone') {
      // Draw drone — small mechanical box with propellers
      const dx = e.x, dy = e.y
      const cx = dx + e.w / 2, cy = dy + e.h / 2
      const bob = Math.sin(state.gameTime * 8 + e.x) * 1.5

      // Body
      ctx.fillStyle = e.state === 'dead' ? '#333' : '#556677'
      ctx.fillRect(cx - 7, cy - 4 + bob, 14, 8)
      // Camera eye
      ctx.fillStyle = e.state === 'dead' ? '#444' : (e.state === 'alert' ? '#ff4444' : '#44ffaa')
      ctx.fillRect(cx - 2, cy - 2 + bob, 4, 3)
      // Propeller arms
      ctx.fillStyle = '#445566'
      ctx.fillRect(cx - 10, cy - 6 + bob, 20, 2)
      // Spinning propellers
      if (e.state !== 'dead') {
        const spin = Math.sin(state.gameTime * 30 + e.x) * 4
        ctx.fillStyle = '#88aabb'
        ctx.fillRect(cx - 10 + spin, cy - 8 + bob, 3, 2)
        ctx.fillRect(cx + 7 - spin, cy - 8 + bob, 3, 2)
      }
      // Landing skids
      ctx.fillStyle = '#445566'
      ctx.fillRect(cx - 6, cy + 4 + bob, 2, 3)
      ctx.fillRect(cx + 4, cy + 4 + bob, 2, 3)
    } else if (!drawEnemySprite(e)) {
      // Fallback to rectangles for non-drone enemies
      const ex = e.x, ey = e.y

      ctx.fillStyle = e.state === 'dead' ? '#553333' : e.state === 'alert' ? '#884444' : '#666677'
      ctx.fillRect(ex + 4, ey + 12, 16, 22)

      ctx.fillStyle = e.state === 'dead' ? '#553333' : '#777788'
      ctx.fillRect(ex + 6, ey, 12, 14)

      if (e.state !== 'dead') {
        ctx.fillStyle = e.state === 'alert' ? '#ff4444' : '#aaaacc'
        const eyeX = e.facing > 0 ? ex + 13 : ex + 8
        ctx.fillRect(eyeX, ey + 4, 3, 3)
      }

      ctx.fillStyle = e.state === 'dead' ? '#443333' : '#555566'
      ctx.fillRect(ex + 5, ey + 34, 5, 10)
      ctx.fillRect(ex + 14, ey + 34, 5, 10)
    }

    // Enemy weapon sprite (skip for drones — weapon is built into the body)
    if (e.state !== 'dead' && e.behavior !== 'drone') {
      const behaviorWeapon: Record<EnemyBehavior, WeaponType> = {
        grunt: 'pistol', shotgunner: 'shotgun', sniper: 'sniper', rusher: 'm16', boss: 'shotgun', drone: 'pistol',
      }
      const ew = weaponSprites[behaviorWeapon[e.behavior]]
      const eArmX = e.x + e.w / 2
      const eArmY = e.y + e.h / 2 - 4
      const eGunAngle = e.state === 'alert'
        ? Math.atan2((player.y + player.h / 2) - eArmY, (player.x + player.w / 2) - eArmX)
        : e.facing > 0 ? 0 : Math.PI
      const flipEGun = Math.abs(eGunAngle) > Math.PI / 2

      ctx.save()
      ctx.translate(eArmX, eArmY)
      ctx.rotate(eGunAngle)
      if (flipEGun) ctx.scale(1, -1)
      ctx.imageSmoothingEnabled = false
      if (ew?.loaded) {
        const targetH = 12
        const scale = targetH / ew.h
        ctx.drawImage(ew.image, 0, -ew.h * scale / 2, ew.w * scale, ew.h * scale)
      } else {
        ctx.fillStyle = '#555566'
        ctx.fillRect(0, -2, 14, 4)
      }
      ctx.restore()

      // Sniper laser sight
      if (e.behavior === 'sniper' && e.state === 'alert') {
        const ew2 = weaponSprites['sniper']
        const targetH = 12
        const gunLen = ew2?.loaded ? ew2.w * (targetH / ew2.h) : 14
        const dirX = Math.cos(eGunAngle)
        const dirY = Math.sin(eGunAngle)
        const lsx = eArmX + dirX * gunLen
        const lsy = eArmY + dirY * gunLen
        const maxRange = 1200

        // Raycast against platforms, cover boxes, and player
        const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h }
        const allRects = [...platforms, ...state.coverBoxes, playerRect]
        let closestT = maxRange
        for (const r of allRects) {
          const tMinX = (r.x - lsx) / dirX
          const tMaxX = (r.x + r.w - lsx) / dirX
          const tMinY = (r.y - lsy) / dirY
          const tMaxY = (r.y + r.h - lsy) / dirY
          const tEnterX = Math.min(tMinX, tMaxX)
          const tExitX = Math.max(tMinX, tMaxX)
          const tEnterY = Math.min(tMinY, tMaxY)
          const tExitY = Math.max(tMinY, tMaxY)
          const tEnter = Math.max(tEnterX, tEnterY)
          const tExit = Math.min(tExitX, tExitY)
          if (tEnter < tExit && tExit > 0 && tEnter > 0 && tEnter < closestT) {
            closestT = tEnter
          }
        }

        const lex = lsx + dirX * closestT
        const ley = lsy + dirY * closestT

        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(lsx, lsy)
        ctx.lineTo(lex, ley)
        ctx.stroke()
        // Dot at hit point
        ctx.globalAlpha = 0.5
        ctx.fillStyle = '#ff0000'
        ctx.beginPath()
        ctx.arc(lex, ley, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    ctx.globalAlpha = 1

    // Health bar (shows when recently hit)
    if (e.state !== 'dead' && e.showHpTimer > 0) {
      const barW = 30
      const barH = 3
      const barX = e.x + e.w / 2 - barW / 2
      const barY = e.y - 8
      const hpRatio = Math.max(0, e.hp / e.maxHp)

      ctx.fillStyle = '#222'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = hpRatio > 0.5 ? '#44aa55' : hpRatio > 0.25 ? '#ddaa22' : '#dd3333'
      ctx.fillRect(barX, barY, barW * hpRatio, barH)

      // Behavior indicator color
      const behaviorColors: Record<EnemyBehavior, string> = {
        grunt: '#888', shotgunner: '#ff8844', sniper: '#44aaff', rusher: '#ff4466', boss: '#ff22ff', drone: '#44ffaa',
      }
      ctx.fillStyle = behaviorColors[e.behavior]
      ctx.fillRect(barX, barY - 2, barW, 1)
    }
  }
}

export function drawPlayer() {
  const ctx = state.ctx!
  const { player, camera, mouse } = state
  const px = player.x, py = player.y

  // Invincibility flash — pulse opacity instead of disappearing
  if (state.invincibleTimer > 0) {
    ctx.globalAlpha = 0.4 + Math.sin(state.gameTime * 20) * 0.3
  }

  if (player.rolling) {
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#6688ff'
    ctx.fillRect(px - player.vx * 0.03, py - player.vy * 0.03, player.w, player.h)
    ctx.globalAlpha = 0.1
    ctx.fillRect(px - player.vx * 0.06, py - player.vy * 0.06, player.w, player.h)
    ctx.globalAlpha = 1
  }

  // Try sprite rendering first
  const playerAnim = getPlayerAnim()
  const playerSheet = playerSprites[playerAnim]
  const flipX = player.facing < 0
  let spriteDrawn = false

  if (playerSheet?.loaded) {
    let rotation = 0
    if (player.rolling) {
      rotation = player.rollDir * (1 - player.rollTimer / 0.4) * Math.PI * 2
    } else if (player.doubleJumping) {
      rotation = player.doubleJumpSpin
    }
    const shouldLoop = playerAnim !== 'fall' && playerAnim !== 'jump' && playerAnim !== 'pickup' && playerAnim !== 'dive' && playerAnim !== 'crouch' && playerAnim !== 'uncrouch' && playerAnim !== 'land' && playerAnim !== 'death'
    const anchorBottom = playerAnim === 'dive'
    const crouchOffset = (playerAnim === 'crouch' || playerAnim === 'uncrouch') ? -8 : 0
    const doubleJumpFrame = player.doubleJumping ? spriteConfig.roll.frames - 1 : -1
    spriteDrawn = drawSprite(playerSheet, px, py + crouchOffset, flipX, rotation, shouldLoop, anchorBottom, doubleJumpFrame)
  }

  // Fallback to rectangle art if sprites not loaded
  if (!spriteDrawn) {
    const bodyColor = player.diving || player.rolling ? '#4466cc' : '#3355aa'
    ctx.fillStyle = bodyColor
    if (player.rolling) {
      ctx.save()
      ctx.translate(px + player.w / 2, py + player.h / 2)
      ctx.rotate(player.rollDir * (1 - player.rollTimer / 0.4) * Math.PI * 2)
      ctx.fillStyle = '#3355aa'
      ctx.fillRect(-12, -12, 24, 24)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(-5, -12, 10, 8)
      ctx.restore()
    } else if (player.diving) {
      ctx.save()
      ctx.translate(px + player.w / 2, py + player.h / 2)
      ctx.rotate(player.diveDir * player.diveTimer * 3)
      ctx.fillRect(-player.w / 2, -player.h / 2 + 10, player.w, player.h - 10)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(-5, -player.h / 2, 12, 14)
      ctx.restore()
    } else if (player.crouching) {
      ctx.fillStyle = '#3355aa'
      ctx.fillRect(px + 2, py + 6, 20, 14)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(px + 6, py - 2, 12, 10)
      ctx.fillStyle = '#224488'
      const eyeX = player.facing > 0 ? px + 13 : px + 8
      ctx.fillRect(eyeX, py + 1, 3, 3)
      ctx.fillStyle = '#223366'
      ctx.fillRect(px + 3, py + 20, 7, 8)
      ctx.fillRect(px + 14, py + 20, 7, 8)
    } else {
      ctx.fillRect(px + 4, py + 12, 16, 22)
      ctx.fillStyle = '#ddccbb'
      ctx.fillRect(px + 6, py, 12, 14)
      ctx.fillStyle = '#224488'
      const eyeX = player.facing > 0 ? px + 13 : px + 8
      ctx.fillRect(eyeX, py + 4, 3, 3)
      ctx.fillStyle = '#223366'
      ctx.fillRect(px + 5, py + 34, 5, 10)
      ctx.fillRect(px + 14, py + 34, 5, 10)
    }
  }

  // Hide arm/weapon when dead
  if (player.hp <= 0) { ctx.globalAlpha = 1; return }

  // Gun arm — arm sprite + weapon, rotating toward mouse
  const aimWorldX = mouse.x + camera.x
  const aimWorldY = mouse.y + camera.y

  // Shoulder position: sprite center + anchor offset
  const spriteCenterX = px + player.w / 2
  const spriteCenterY = py + player.h / 2
  const shoulderX = spriteCenterX + (player.facing > 0 ? ARM_ANCHOR_X : -ARM_ANCHOR_X)
  const shoulderY = spriteCenterY + ARM_ANCHOR_Y

  const gunAngle = Math.atan2(aimWorldY - shoulderY, aimWorldX - shoulderX)
  const flipGun = Math.abs(gunAngle) > Math.PI / 2

  ctx.save()
  ctx.translate(shoulderX, shoulderY)
  ctx.rotate(gunAngle - Math.PI / 2) // arm sprite points up, rotate +90° so it points right
  if (flipGun) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false

  // Draw arm sprite — pivot at (ARM_PIVOT_X, ARM_PIVOT_Y) in the 68x68 image
  const armImg = state.armSprite
  if (armImg) {
    ctx.drawImage(armImg, -ARM_PIVOT_X, -ARM_PIVOT_Y, 68, 68)
  }

  // Draw weapon at hand position (relative to pivot)
  const ws = weaponSprites[state.currentWeapon]
  const handOffX = ARM_HAND_X - ARM_PIVOT_X  // hand offset from pivot in sprite coords
  const handOffY = ARM_HAND_Y - ARM_PIVOT_Y
  if (ws?.loaded) {
    const targetH = 12
    const scale = targetH / ws.h
    const drawW = ws.w * scale
    const drawH = ws.h * scale
    ctx.save()
    ctx.translate(handOffX, handOffY)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(ws.image, 0, -drawH / 2, drawW, drawH)
    ctx.restore()
  } else {
    ctx.save()
    ctx.translate(handOffX, handOffY)
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = '#555566'
    ctx.fillRect(-7, -2, 14, 4)
    ctx.restore()
  }
  ctx.restore()

  // Laser pointer for M16 and Sniper
  const hasLaser = state.currentWeapon === 'm16' || state.currentWeapon === 'sniper'
  if (hasLaser) {
    const ws2 = weaponSprites[state.currentWeapon]
    const targetH = 12
    const gunLen = ws2?.loaded ? ws2.w * (targetH / ws2.h) : 14
    const handDist = Math.sqrt((ARM_HAND_X - ARM_PIVOT_X) ** 2 + (ARM_HAND_Y - ARM_PIVOT_Y) ** 2)
    const barrelDist = handDist + gunLen
    const dirX = Math.cos(gunAngle)
    const dirY = Math.sin(gunAngle)
    const laserStartX = shoulderX + dirX * barrelDist
    const laserStartY = shoulderY + dirY * barrelDist

    const maxRange = state.currentWeapon === 'sniper' ? 3000 : 2000
    const aliveEnemies = state.enemies.filter(e => e.state !== 'dead')
    const allRects = [...platforms, ...state.coverBoxes, ...aliveEnemies]

    let closestT = maxRange
    for (const r of allRects) {
      const tMinX = (r.x - laserStartX) / dirX
      const tMaxX = (r.x + r.w - laserStartX) / dirX
      const tMinY = (r.y - laserStartY) / dirY
      const tMaxY = (r.y + r.h - laserStartY) / dirY

      const tEnterX = Math.min(tMinX, tMaxX)
      const tExitX = Math.max(tMinX, tMaxX)
      const tEnterY = Math.min(tMinY, tMaxY)
      const tExitY = Math.max(tMinY, tMaxY)

      const tEnter = Math.max(tEnterX, tEnterY)
      const tExit = Math.min(tExitX, tExitY)

      if (tEnter < tExit && tExit > 0 && tEnter > 0 && tEnter < closestT) {
        closestT = tEnter
      }
    }

    const laserEndX = laserStartX + dirX * closestT
    const laserEndY = laserStartY + dirY * closestT

    const isSniper = state.currentWeapon === 'sniper'
    ctx.save()
    ctx.globalAlpha = isSniper ? 0.4 : 0.4
    ctx.strokeStyle = isSniper ? '#ff0000' : '#00ff00'
    ctx.lineWidth = isSniper ? 0.5 : 1
    ctx.beginPath()
    ctx.moveTo(laserStartX, laserStartY)
    ctx.lineTo(laserEndX, laserEndY)
    ctx.stroke()
    // Dot at hit point
    ctx.globalAlpha = isSniper ? 0.6 : 0.6
    ctx.fillStyle = isSniper ? '#ff0000' : '#00ff00'
    ctx.beginPath()
    ctx.arc(laserEndX, laserEndY, isSniper ? 1.5 : 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Grenade trajectory preview while charging
  if (state.grenadeCharging && state.currentWeapon === 'grenades') {
    const chargePower = 0.3 + (state.grenadeChargeTime / 1.5) * 0.7
    const cx = player.x + player.w / 2
    const cy = player.y + player.h / 2 - 4
    const baseAngle = Math.atan2(aimWorldY - cy, aimWorldX - cx)
    let simX = cx
    let simY = cy
    let simVx = Math.cos(baseAngle) * WEAPONS.grenades.bulletSpeed * chargePower
    let simVy = Math.sin(baseAngle) * WEAPONS.grenades.bulletSpeed * chargePower - 200 * chargePower
    const simDt = 0.02
    const steps = Math.floor(80 * chargePower)

    ctx.globalAlpha = 0.4
    for (let s = 0; s < steps; s++) {
      simVy += GRAVITY * simDt
      simX += simVx * simDt
      simY += simVy * simDt

      // Bounce off surfaces
      const allSolids = [...platforms, ...state.coverBoxes]
      for (const solid of allSolids) {
        if (simX >= solid.x && simX <= solid.x + solid.w && simY >= solid.y && simY <= solid.y + solid.h) {
          const fromTop = simY - solid.y
          const fromBottom = solid.y + solid.h - simY
          const fromLeft = simX - solid.x
          const fromRight = solid.x + solid.w - simX
          const min = Math.min(fromTop, fromBottom, fromLeft, fromRight)
          if (min === fromTop || min === fromBottom) {
            simVy = -simVy * GRENADE_BOUNCE_DAMP
            simY = min === fromTop ? solid.y : solid.y + solid.h
          } else {
            simVx = -simVx * GRENADE_BOUNCE_DAMP
            simX = min === fromLeft ? solid.x : solid.x + solid.w
          }
          simVx *= 0.8
        }
      }

      // Draw dot every few steps
      if (s % 3 === 0) {
        const dotAlpha = 1 - s / steps
        ctx.fillStyle = `rgba(100,150,255,${dotAlpha * 0.6})`
        ctx.beginPath()
        ctx.arc(simX, simY, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // Charge power bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(cx - 15, cy - 20, 30, 4)
    ctx.fillStyle = `rgb(${Math.floor(255 * chargePower)}, ${Math.floor(200 * (1 - chargePower))}, 50)`
    ctx.fillRect(cx - 15, cy - 20, 30 * chargePower, 4)
  }
  ctx.globalAlpha = 1
}

// ─── Draw Remote Player (P2) ────────────────────────────────────────────────

const PLAYER_COLORS = ['#ffcc44', '#44ccff', '#ff66aa', '#66ff88']

export function drawRemotePlayer() {
  if (!state.coopEnabled || state.players.length < 2) return
  const ctx = state.ctx!

  for (let i = 1; i < state.players.length; i++) {
    const rp = state.players[i]
    const px = rp.x, py = rp.y
    const color = PLAYER_COLORS[(i - 1) % PLAYER_COLORS.length]

    ctx.globalAlpha = 0.85

    if (rp.rolling) {
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#ff6688'
      ctx.fillRect(px - rp.vx * 0.03, py - rp.vy * 0.03, rp.w, rp.h)
      ctx.globalAlpha = 0.85
    }

    const anim = (rp.currentAnim || 'idle') as import('../types').PlayerAnim
    const sheet = playerSprites[anim]
    const flipX = rp.facing < 0
    let spriteDrawn = false

    if (sheet?.loaded) {
      let rotation = 0
      if (rp.rolling) {
        rotation = rp.rollDir * (1 - rp.rollTimer / 0.4) * Math.PI * 2
      } else if (rp.doubleJumping) {
        rotation = rp.doubleJumpSpin
      }
      const shouldLoop = anim !== 'fall' && anim !== 'jump' && anim !== 'pickup' && anim !== 'dive' && anim !== 'crouch' && anim !== 'uncrouch' && anim !== 'land' && anim !== 'death'
      const anchorBottom = anim === 'dive'
      const crouchOffset = (anim === 'crouch' || anim === 'uncrouch') ? -8 : 0
      spriteDrawn = drawSprite(sheet, px, py + crouchOffset, flipX, rotation, shouldLoop, anchorBottom, -1)
    }

    if (!spriteDrawn) {
      ctx.fillStyle = rp.diving || rp.rolling ? '#cc4466' : '#aa3355'
      if (rp.crouching) {
        ctx.fillRect(px + 2, py + 6, 20, 14)
        ctx.fillStyle = '#ddccbb'
        ctx.fillRect(px + 6, py - 2, 12, 10)
      } else {
        ctx.fillRect(px + 4, py + 12, 16, 22)
        ctx.fillStyle = '#ddccbb'
        ctx.fillRect(px + 6, py, 12, 14)
      }
    }

    if (rp.hp <= 0) { ctx.globalAlpha = 1; continue }

    // Gun arm
    const aimAngle = rp.aimAngle || 0
    const spriteCenterX = px + rp.w / 2
    const spriteCenterY = py + rp.h / 2
    const shoulderX = spriteCenterX + (rp.facing > 0 ? ARM_ANCHOR_X : -ARM_ANCHOR_X)
    const shoulderY = spriteCenterY + ARM_ANCHOR_Y
    const flipGun = Math.abs(aimAngle) > Math.PI / 2

    ctx.save()
    ctx.translate(shoulderX, shoulderY)
    ctx.rotate(aimAngle - Math.PI / 2)
    if (flipGun) ctx.scale(-1, 1)
    ctx.imageSmoothingEnabled = false

    const armImg = state.armSprite
    if (armImg) {
      ctx.drawImage(armImg, -ARM_PIVOT_X, -ARM_PIVOT_Y, 68, 68)
    }

    const ws = weaponSprites[(rp.currentWeapon || 'pistol') as import('../types').WeaponType]
    const handOffX = ARM_HAND_X - ARM_PIVOT_X
    const handOffY = ARM_HAND_Y - ARM_PIVOT_Y
    if (ws?.loaded) {
      const targetH = 12
      const scale = targetH / ws.h
      ctx.save()
      ctx.translate(handOffX, handOffY)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(ws.image, 0, -ws.h * scale / 2, ws.w * scale, ws.h * scale)
      ctx.restore()
    }
    ctx.restore()

    // Nametag
    ctx.globalAlpha = 0.7
    ctx.fillStyle = color
    ctx.font = 'bold 10px Audiowide, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`P${i + 1}`, px + rp.w / 2, py - 8)

    ctx.globalAlpha = 1
  }
}
