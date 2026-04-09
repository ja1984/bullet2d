// ─── Bullets ─────────────────────────────────────────────────────────────────

import type { WeaponType } from '../types'
import { COMBO_WINDOW, GRENADE_RADIUS, WEAPONS, platforms } from '../constants'
import { state, saveScore } from '../state'
import { SFX } from '../audio'
import { spawnParticles, spawnExplosionLight } from './particles'
import { enemyTypes } from '../sprites/enemySprites'

export function updateBullets(gameDt: number) {
  const { bullets, coverBoxes, enemies, player, floatingTexts, bloodDecals, ammoPickups } = state

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.trail.push({ x: b.x, y: b.y })
    const maxTrail = state.player.bulletTimeActive ? 20 : 8
    if (b.trail.length > maxTrail) b.trail.shift()

    b.x += b.vx * gameDt
    b.y += b.vy * gameDt
    b.life -= gameDt

    if (b.life <= 0) { bullets.splice(i, 1); continue }

    // Hit platforms
    let hitWall = false
    for (let pi = platforms.length - 1; pi >= 0; pi--) {
      const p = platforms[pi]
      if (b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h) {
        if (p.destructible && p.hp !== undefined) {
          p.hp -= b.damage
          spawnParticles(b.x, b.y, 3, '#aa8855', 60)
          if (p.hp <= 0) {
            SFX.explosion()
            spawnParticles(p.x + p.w / 2, p.y + p.h / 2, 12, '#aa8855', 180)
            spawnExplosionLight(p.x + p.w / 2, p.y + p.h / 2)
            state.screenShake = 4
            // Make boxes on this platform fall
            for (const box of coverBoxes) {
              if (box.x + box.w > p.x && box.x < p.x + p.w &&
                  box.y + box.h >= p.y - 2 && box.y + box.h <= p.y + 4) {
                box.falling = true
                box.vy = 0
              }
            }
            platforms.splice(pi, 1)
          }
        }
        hitWall = true
        break
      }
    }
    if (hitWall) {
      if (b.penetrate && !b.ricocheted) {
        // Ricochet — bounce off wall once
        b.ricocheted = true
        // Determine bounce direction (horizontal vs vertical surface)
        // Simple heuristic: if bullet is more horizontal, flip vy; else flip vx
        const absVx = Math.abs(b.vx)
        const absVy = Math.abs(b.vy)
        if (absVx > absVy) { b.vx = -b.vx } else { b.vy = -b.vy }
        b.damage *= 0.5
        spawnParticles(b.x, b.y, 8, '#ffcc44', 120)
        state.lightFlashes.push({ x: b.x, y: b.y, intensity: 0.5, color: 'rgba(255,200,100,' })
      } else {
        spawnParticles(b.x, b.y, 5, '#ff8', 100)
        bullets.splice(i, 1)
        continue
      }
    }

    // Hit cover boxes
    let hitBox = false
    for (let j = coverBoxes.length - 1; j >= 0; j--) {
      const box = coverBoxes[j]
      if (b.x >= box.x && b.x <= box.x + box.w && b.y >= box.y && b.y <= box.y + box.h) {
        box.hp -= b.damage
        spawnParticles(b.x, b.y, 4, box.type === 'explosive' ? '#ff4422' : box.type === 'barrel' ? '#884422' : '#aa8855', 80)
        if (box.hp <= 0) {
          const cx = box.x + box.w / 2
          const cy = box.y + box.h / 2
          if (box.type === 'explosive') {
            // Explosive barrel — big explosion that damages nearby entities
            SFX.explosion()
            spawnParticles(cx, cy, 30, '#ff4400', 350)
            spawnParticles(cx, cy, 15, '#ffcc00', 250)
            spawnExplosionLight(cx, cy)
            state.screenShake = 15
            state.hitPauseTimer = 0.06
            const radius = GRENADE_RADIUS * 1.2
            // Damage enemies
            for (const e of enemies) {
              if (e.state === 'dead') continue
              const edx = (e.x + e.w / 2) - cx
              const edy = (e.y + e.h / 2) - cy
              const dist = Math.sqrt(edx * edx + edy * edy)
              if (dist < radius) {
                const falloff = 1 - dist / radius
                const dmg = 60 * falloff
                e.hp -= dmg
                e.vy = -150 * falloff
                e.vx = edx > 0 ? 200 * falloff : -200 * falloff
                e.showHpTimer = 2
                if (e.hp <= 0) {
                  e.state = 'dead'
                  SFX.enemyDeath()
                  e.deathTimer = 3
                  state.killCount++
                  state.hitPauseTimer = 0.07
                  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 20, '#f44', 250)
                  bloodDecals.push({ x: e.x + e.w / 2, y: e.y + e.h, size: 15 + Math.random() * 15, alpha: 1 })
                }
              }
            }
            // Damage player
            const pdx = (player.x + player.w / 2) - cx
            const pdy = (player.y + player.h / 2) - cy
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy)
            if (pDist < radius && state.invincibleTimer <= 0) {
              const falloff = 1 - pDist / radius
              player.hp -= 25 * falloff
              player.vy = -200 * falloff
            }
            // Chain reaction — damage other cover boxes
            for (const other of coverBoxes) {
              if (other === box) continue
              const odx = (other.x + other.w / 2) - cx
              const ody = (other.y + other.h / 2) - cy
              const oDist = Math.sqrt(odx * odx + ody * ody)
              if (oDist < radius) {
                other.hp -= 40 * (1 - oDist / radius)
              }
            }
          } else {
            // Normal box destruction
            SFX.explosion()
            spawnParticles(cx, cy, 15,
              box.type === 'barrel' ? '#ff6622' : '#aa8855', 200)
            spawnExplosionLight(cx, cy)
            state.screenShake = 6
          }
          coverBoxes.splice(j, 1)
        }
        hitBox = true
        break
      }
    }
    if (hitBox) { bullets.splice(i, 1); continue }

    // Hit enemies (player bullets) — 3-zone hitbox: head, body, legs
    if (b.owner === 'player') {
      let hit = false
      for (const e of enemies) {
        if (e.state === 'dead') continue
        // Broad check first
        if (b.x < e.x || b.x > e.x + e.w || b.y < e.y || b.y > e.y + e.h) continue

        let dmgMultiplier: number
        let hitZone: string
        const relY = b.y - e.y

        if (relY < 14) {
          dmgMultiplier = 100 // instakill
          hitZone = 'head'
        } else if (relY < 34) {
          dmgMultiplier = 2.5 // 2-3 pistol shots
          hitZone = 'body'
        } else {
          dmgMultiplier = 1 // ~4 pistol shots
          hitZone = 'legs'
        }

        const finalDamage = b.damage * dmgMultiplier
        e.hp -= finalDamage
        e.hitTimer = 0.3
        e.showHpTimer = 2

        // Damage number
        const dmgText = hitZone === 'head' ? 'HEADSHOT!' : Math.round(finalDamage).toString()
        const dmgColor = hitZone === 'head' ? '#ff2222' : hitZone === 'body' ? '#ffcc44' : '#ff8844'
        floatingTexts.push({
          x: b.x + (Math.random() - 0.5) * 10,
          y: b.y - 5,
          text: dmgText, color: dmgColor,
          life: 0.8, maxLife: 0.8,
        })

        // Visual feedback per zone
        state.hitMarkerTimer = 0.15
        state.shotsHit++
        if (hitZone === 'head') {
          spawnParticles(b.x, b.y, 15, '#ff2222', 200)
          state.screenShake = 8
          state.screenFlash = 'rgba(255,255,255,0.8)'
          state.screenFlashTimer = 0.08
          SFX.headshot()
        } else if (hitZone === 'body') {
          SFX.bulletImpact()
          spawnParticles(b.x, b.y, 8, '#f44', 150)
          state.screenShake = 5
        } else {
          spawnParticles(b.x, b.y, 5, '#f84', 100)
          state.screenShake = 3
          SFX.bulletImpact()
        }

        if (bloodDecals.length > 100) bloodDecals.shift()

        if (e.hp <= 0) {
          e.state = 'dead'
          state.hitPauseTimer = 0.05
          SFX.enemyDeath()
          const deathFrames = enemyTypes[e.type]?.spriteConfig.death.frames ?? 10
          const deathFps = enemyTypes[e.type]?.spriteConfig.death.fps ?? 10
          e.deathTimer = (deathFrames / deathFps) + 2
          e.vy = 0
          e.vx = 0
          state.killCount++
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 20, '#f44', 250)
          state.screenShake = 10

          // Combo system
          state.comboCount++
          state.comboTimer = COMBO_WINDOW
          if (state.comboCount >= 2) {
            floatingTexts.push({
              x: e.x + e.w / 2, y: e.y - 25,
              text: `${state.comboCount}x COMBO!`, color: '#ffaa22',
              life: 1.0, maxLife: 1.0,
            })
          }

          // Blood splatter decal on ground
          bloodDecals.push({ x: e.x + e.w / 2, y: e.y + e.h, size: 15 + Math.random() * 15, alpha: 1 })

          // Ammo drop (40% chance)
          if (Math.random() < 0.4) {
            const dropTypes: WeaponType[] = ['shotgun', 'm16', 'sniper', 'grenades']
            const dropType = dropTypes[Math.floor(Math.random() * dropTypes.length)]
            const dropAmounts: Record<WeaponType, number> = { pistol: 0, shotgun: 4, m16: 15, sniper: 3, grenades: 2 }
            ammoPickups.push({
              x: e.x + e.w / 2, y: e.y,
              vy: -120, onGround: false,
              life: 15, bobTimer: 0,
              weaponType: dropType,
              amount: dropAmounts[dropType],
            })
          }

          // Kill feed
          state.multiKillCount++
          state.multiKillTimer = 1.5
          if (hitZone === 'head') {
            state.killFeed.push({ text: 'HEADSHOT!', color: '#ff2222', life: 2.5, maxLife: 2.5 })
          }
          if (state.multiKillCount === 2) {
            state.killFeed.push({ text: 'DOUBLE KILL!', color: '#ff8844', life: 2.5, maxLife: 2.5 })
          } else if (state.multiKillCount === 3) {
            state.killFeed.push({ text: 'TRIPLE KILL!', color: '#ffaa22', life: 2.5, maxLife: 2.5 })
          } else if (state.multiKillCount === 4) {
            state.killFeed.push({ text: 'QUAD KILL!', color: '#ffcc00', life: 3.0, maxLife: 3.0 })
          } else if (state.multiKillCount >= 5) {
            state.killFeed.push({ text: 'RAMPAGE!', color: '#ff00ff', life: 3.0, maxLife: 3.0 })
          }
          if (state.killFeed.length > 5) state.killFeed.shift()

          // Kill cam — slow-mo on last enemy of wave
          const aliveCount = enemies.filter(en => en !== e && en.state !== 'dead').length
          if (aliveCount === 0 && state.waveState === 'active') {
            state.killCamActive = true
            state.killCamTimer = 1.5
          }
        }
        // Sniper penetration — 60% chance to go through
        if (b.penetrate && Math.random() < 0.6) {
          b.damage *= 0.7 // reduce damage on pass-through
          continue // don't break — check next enemy
        }
        hit = true
        break
      }
      if (hit) { bullets.splice(i, 1); continue }
    }

    // Hit player (enemy bullets)
    if (b.owner === 'enemy' && state.invincibleTimer <= 0) {
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        player.hp -= b.damage
        player.hitFlash = 0.15
        state.screenFlash = 'rgba(255,0,0,0.7)'
        state.screenFlashTimer = 0.1
        SFX.playerHit()
        spawnParticles(b.x, b.y, 6, '#f88', 100)
        state.screenShake = 6
        bullets.splice(i, 1)
        if (player.hp <= 0) {
          state.gameOver = true
          state.deathSlowMo = true
          state.deathSlowMoTimer = 2.0
          spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 30, '#f44', 300)
          saveScore()
        }
      }
    }
  }
}
