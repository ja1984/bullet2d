// ─── Update ──────────────────────────────────────────────────────────────────

import {
  BULLET_LIFE, BULLET_TIME_MAX, BULLET_TIME_RECHARGE, BULLET_TIME_SCALE,
  DIVE_DURATION, DIVE_SPEED, ENEMY_CONFIGS, GRAVITY, PLAYER_JUMP,
  PLAYER_MAX_HP, PLAYER_SPEED, WEAPONS, DOUBLE_TAP_WINDOW, CANVAS_W, spriteConfig,
  ARM_ANCHOR_X, ARM_ANCHOR_Y, ARM_PIVOT_X, platforms,
  WALL_SLIDE_SPEED, WALL_JUMP_FORCE_X, WALL_JUMP_FORCE_Y,
  GRENADE_FUSE, GRENADE_RADIUS, GRENADE_BOUNCE_DAMP,
} from './constants'
import { state, saveScore, checkAllPlayersDead } from './state'
import { SFX, setAudioBulletTime, playSound, updateMusicIntensity } from './audio'
import { getPlayerAnim } from './sprites/playerSprites'
import { weaponSprites } from './sprites/weaponSprites'
import { resolvePhysics, checkWallContact } from './systems/physics'
import { spawnParticles, spawnMuzzleFlash, spawnExplosionLight } from './systems/particles'
import { updateBullets } from './systems/bullets'
import { updateWeaponPickups, updateHealthPickups, updateAmmoPickups } from './systems/pickups'
import { startWave, getDifficultyMult, spawnEnemy } from './systems/waves'
import { updateAmbient, spawnAmbientObjects } from './systems/ambient'
import type { EnemyBehavior } from './types'
import { updateCamera } from './systems/camera'
import { sendPlayerState, updateRemotePlayer, syncGameEvents, isOnline, isHost, isServerAuthoritative, queueBulletSync, sendRestart } from './systems/network'
import { restart } from './main'

export function update(dt: number) {
  state.gameTime += dt

  if (state.gameOver) {
    // In co-op, keep the game running so the other player can continue
    if (state.coopEnabled) {
      // Still sync network state
      sendPlayerState()
      updateRemotePlayer(dt)
      syncGameEvents()
    }
    if (state.deathSlowMo) {
      state.deathSlowMoTimer -= dt
      if (state.deathSlowMoTimer <= 0) state.deathSlowMo = false
      // Still update particles during death slow-mo
      const ddt = dt * 0.3
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i]
        p.x += p.vx * ddt; p.y += p.vy * ddt; p.vy += 400 * ddt; p.life -= ddt
        if (p.life <= 0) state.particles.splice(i, 1)
      }
    }
    if (state.keys['KeyR']) {
      restart()
      SFX.startAmbient()
      if (state.coopEnabled) sendRestart()
    }
    if (!state.coopEnabled) return
  }

  // Hit pause — freeze the game for a few frames on kill
  if (state.hitPauseTimer > 0) {
    state.hitPauseTimer -= dt
    return
  }

  // Invincibility timer
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt

  // Bullet time (toggle on Shift press)
  const shiftDown = state.keys['Space']
  if (shiftDown && state.shiftWasUp) {
    state.bulletTimeToggled = !state.bulletTimeToggled
    if (state.bulletTimeToggled) SFX.bulletTimeOn()
    else SFX.bulletTimeOff()
  }
  state.shiftWasUp = !shiftDown

  if (state.bulletTimeToggled && state.player.bulletTimeEnergy > 0) {
    state.player.bulletTimeActive = true
    state.player.bulletTimeEnergy -= dt
    if (state.player.bulletTimeEnergy <= 0) {
      state.player.bulletTimeEnergy = 0
      state.player.bulletTimeActive = false
      state.bulletTimeToggled = false
    }
  } else {
    state.player.bulletTimeActive = false
    state.bulletTimeToggled = false
    state.player.bulletTimeEnergy = Math.min(BULLET_TIME_MAX, state.player.bulletTimeEnergy + BULLET_TIME_RECHARGE * dt)
  }

  state.timeScale = (state.player.bulletTimeActive || state.killCamActive) ? BULLET_TIME_SCALE : (state.deathSlowMo ? 0.3 : 1)
  setAudioBulletTime(state.player.bulletTimeActive)
  updateMusicIntensity(state.enemies.filter(e => e.state !== 'dead').length)
  const gameDt = dt * state.timeScale

  // Player animation timer
  const newAnim = getPlayerAnim()
  if (newAnim !== state.currentAnim) {
    state.currentAnim = newAnim
    if (state.animTimerOverride < 0) state.animTimer = 0
    else { state.animTimer = state.animTimerOverride; state.animTimerOverride = -1 }
  }
  state.animTimer += gameDt

  // Screen shake decay
  state.screenShake *= 0.9

  // Player hit flash
  const player = state.player
  if (player.hitFlash > 0) player.hitFlash -= dt
  if (player.pickupTimer > 0) {
    player.pickupTimer -= dt
    if (player.pickupTimer <= 0) {
      player.h = player.standingH
    }
  }

  // ── Player Movement ──
  // Skip all input/movement when dead
  if (player.hp <= 0) {
    player.vx = 0
    player.vy = 0
    state.mouseClicked = false
    // Jump to after shooting/movement — still update enemies, bullets, waves etc.
  } else {
  const aimWorldX = state.mouse.x + state.camera.x
  const aimWorldY = state.mouse.y + state.camera.y
  player.facing = aimWorldX > player.x + player.w / 2 ? 1 : -1

  // Double-tap detection
  const leftDown = state.keys['KeyA'] || state.keys['ArrowLeft']
  const rightDown = state.keys['KeyD'] || state.keys['ArrowRight']
  let doubleTapLeft = false
  let doubleTapRight = false

  if (leftDown && state.leftWasUp) {
    const now = state.gameTime
    if (now - state.lastLeftTap < DOUBLE_TAP_WINDOW) {
      doubleTapLeft = true
    }
    state.lastLeftTap = now
  }
  state.leftWasUp = !leftDown

  if (rightDown && state.rightWasUp) {
    const now = state.gameTime
    if (now - state.lastRightTap < DOUBLE_TAP_WINDOW) {
      doubleTapRight = true
    }
    state.lastRightTap = now
  }
  state.rightWasUp = !rightDown

  // Crouch
  const wantsCrouch = (state.keys['KeyS'] || state.keys['ArrowDown']) && player.onGround && !player.diving
  if (wantsCrouch && !player.crouching) {
    player.crouching = true
    player.uncrouchTimer = 0
    player.y += player.standingH - player.crouchH
    player.h = player.crouchH
  } else if (!wantsCrouch && player.crouching) {
    player.crouching = false
    player.uncrouchTimer = spriteConfig.uncrouch.frames / spriteConfig.uncrouch.fps
    player.y -= player.standingH - player.crouchH
    player.h = player.standingH
  }
  if (player.uncrouchTimer > 0) player.uncrouchTimer -= dt

  if (!player.diving) {
    player.vx = 0
    const moveSpeed = player.crouching ? PLAYER_SPEED * 0.4 : PLAYER_SPEED
    if (leftDown) player.vx = -moveSpeed
    if (rightDown) player.vx = moveSpeed

    const jumpPressed = state.keys['KeyW'] || state.keys['ArrowUp']

    if (player.onGround) {
      // Trigger landing animation only if we were airborne from a jump
      if (player.wasAirborne && player.landingTimer <= 0 && !player.diving) {
        player.landingTimer = spriteConfig.land.frames / spriteConfig.land.fps
      }
      player.wasAirborne = false
      player.jumpCount = 0
      player.doubleJumping = false
      player.doubleJumpSpin = 0
      player.jumpHoldTime = 0
      if (!jumpPressed) player.jumpWasReleased = true
    }
    if (player.landingTimer > 0) player.landingTimer -= dt
    if (player.doubleJumping) {
      player.doubleJumpSpin += dt * player.facing * Math.PI * 4
    }

    if (!jumpPressed) {
      player.jumpWasReleased = true
      // Cut jump short when releasing early
      if (player.vy < 0 && player.jumpHoldTime > 0) {
        player.vy *= 0.5
        player.jumpHoldTime = 0
      }
      // End double jump spin on release (only once)
      if (player.doubleJumping) {
        player.doubleJumping = false
        player.doubleJumpSpin = 0
        state.animTimerOverride = 2 / spriteConfig.jump.fps
      }
    }

    // Start a new jump on fresh press
    if (jumpPressed && player.jumpWasReleased && player.jumpCount < 2) {
      if (player.onGround || player.jumpCount === 1) {
        const jumpForce = player.jumpCount === 0 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
        player.vy = jumpForce * 0.6 // initial burst (short jump minimum)
        player.jumpHoldTime = gameDt
        if (player.jumpCount === 1) {
          player.doubleJumping = true
          player.doubleJumpSpin = 0
        }
        player.jumpCount++
        player.wasAirborne = true
        player.jumpWasReleased = false
      }
    }

    // Variable jump height — keep adding force while holding
    if (jumpPressed && !player.jumpWasReleased && player.jumpHoldTime > 0 && player.jumpHoldTime < player.jumpMaxHold) {
      player.jumpHoldTime += gameDt
      const jumpForce = player.jumpCount === 1 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
      player.vy = jumpForce * (0.6 + 0.4 * (player.jumpHoldTime / player.jumpMaxHold))
    }
    const shouldDive = doubleTapLeft || doubleTapRight
    if (shouldDive && !player.rolling) {
      const diveDirection = doubleTapRight ? 1 : -1
      if (player.crouching) {
        // Action roll — stay low, fast ground movement
        player.rolling = true
        player.rollTimer = 0.4
        player.rollDir = diveDirection
        player.vx = DIVE_SPEED * 1.2 * diveDirection
        player.vy = 0
      } else {
        player.diving = true
        player.diveTimer = DIVE_DURATION
        player.diveDir = diveDirection
        player.vx = DIVE_SPEED * diveDirection
        player.vy = player.onGround ? -120 : -80
      }
    }
  } else {
    player.diveTimer -= gameDt
    if (player.diveTimer <= 0) {
      player.diving = false
    } else if (player.onGround) {
      player.vx = player.diveDir * DIVE_SPEED * 0.5
    }
    // Allow jump to cancel dive
    const jumpDuringDive = state.keys['KeyW'] || state.keys['ArrowUp']
    if (jumpDuringDive && player.jumpWasReleased && player.onGround) {
      player.diving = false
      player.vy = -PLAYER_JUMP * 0.6
      player.jumpCount = 1
      player.jumpHoldTime = gameDt
      player.wasAirborne = true
      player.jumpWasReleased = false
    }
  }

  // Roll update
  if (player.rolling) {
    player.rollTimer -= gameDt
    player.vx = DIVE_SPEED * 1.2 * player.rollDir * (player.rollTimer / 0.4)
    if (player.rollTimer <= 0) {
      player.rolling = false
    }
  }

  // Speed trail particles during dive/roll
  if (player.diving || player.rolling) {
    const trailX = player.x + player.w / 2 - player.vx * 0.02
    const trailY = player.y + player.h / 2
    state.particles.push({
      x: trailX + (Math.random() - 0.5) * 8,
      y: trailY + (Math.random() - 0.5) * 8,
      vx: -player.vx * 0.3 + (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 20,
      life: 0.15 + Math.random() * 0.1,
      maxLife: 0.2,
      color: '#4466aa',
      size: 2 + Math.random() * 2,
    })
  }

  resolvePhysics(player, gameDt)

  // Clamp player inside level bounds
  if (player.x < 20) player.x = 20
  if (player.x + player.w > 2380) player.x = 2380 - player.w

  // Fall death — below ground level
  if (player.y > 800) {
    player.hp = 0
    state.animTimer = 0
    checkAllPlayersDead()
  }

  // ── Weapon Pickups ──
  updateWeaponPickups(dt)

  // ── Grenade Charge ──
  if (state.grenadeCharging) {
    state.grenadeChargeTime = Math.min(state.grenadeChargeTime + dt, 1.5) // max 1.5s charge
    // Release — throw grenade
    if (!state.mouseDown) {
      state.grenadeCharging = false
      const chargePower = 0.3 + (state.grenadeChargeTime / 1.5) * 0.7 // 30% to 100% power
      const cx = player.x + player.w / 2
      const cy = player.y + player.h / 2 - 4
      const baseAngle = Math.atan2(aimWorldY - cy, aimWorldX - cx)
      state.grenades.push({
        x: cx, y: cy,
        vx: Math.cos(baseAngle) * WEAPONS.grenades.bulletSpeed * chargePower,
        vy: Math.sin(baseAngle) * WEAPONS.grenades.bulletSpeed * chargePower - 200 * chargePower,
        fuseTimer: GRENADE_FUSE,
        bounces: 0,
      })
      state.screenShake = WEAPONS.grenades.shake
      player.shootCooldown = WEAPONS.grenades.fireRate
      state.grenadeChargeTime = 0
    }
  }

  // ── Shooting ──
  const weapon = WEAPONS[state.currentWeapon]
  player.shootCooldown -= dt

  // Reload logic
  if (player.reloading) {
    player.reloadTimer -= dt
    if (player.reloadTimer <= 0) {
      player.reloading = false
      const ammo = state.playerAmmo[state.currentWeapon]
      if (ammo === -1) {
        // Infinite ammo — full mag
        state.magRounds[state.currentWeapon] = weapon.magSize
      } else {
        // Deduct from reserves
        const needed = weapon.magSize - state.magRounds[state.currentWeapon]
        const toLoad = Math.min(needed, ammo)
        state.magRounds[state.currentWeapon] += toLoad
        state.playerAmmo[state.currentWeapon] -= toLoad
      }
    }
  }

  // Manual reload with R
  const hasReserves = state.playerAmmo[state.currentWeapon] === -1 || state.playerAmmo[state.currentWeapon] > 0
  if (state.keys['KeyR'] && !player.reloading && state.magRounds[state.currentWeapon] < weapon.magSize && hasReserves) {
    player.reloading = true
    player.reloadTimer = weapon.reloadTime

    state.keys['KeyR'] = false
  }

  const canShoot = weapon.auto ? state.mouseDown : state.mouseClicked
  state.mouseClicked = false
  if (canShoot && player.shootCooldown <= 0 && player.reloading) {
    SFX.emptyClick()
    player.shootCooldown = 0.2 // prevent spam
  }
  if (canShoot && player.shootCooldown <= 0 && !player.reloading) {
    // Check mag
    if (state.magRounds[state.currentWeapon] <= 0) {
      // Auto reload when mag empty
      SFX.emptyClick()
  
      player.reloading = true
      player.reloadTimer = weapon.reloadTime
      return
    }
    state.magRounds[state.currentWeapon]--
    state.shotsFired++

    // Auto-reload when mag empties (only if reserves available)
    if (state.magRounds[state.currentWeapon] <= 0) {
      const hasAmmoReserve = state.playerAmmo[state.currentWeapon] === -1 || state.playerAmmo[state.currentWeapon] > 0
      if (hasAmmoReserve) {
        player.reloading = true
        player.reloadTimer = weapon.reloadTime
    
      } else {
        // Out of ammo — switch to pistol
        state.currentWeapon = 'pistol'
        player.shootCooldown = 0.3
      }
    }

    if (state.currentWeapon === 'grenades') {
      // Start charging grenade
      state.grenadeCharging = true
      state.grenadeChargeTime = 0
    } else {
    // Dual pistols — alternate hands, faster fire rate
    const isDualPistol = state.currentWeapon === 'pistol'
    player.shootCooldown = isDualPistol ? weapon.fireRate * 0.6 : weapon.fireRate
    const handOffset = isDualPistol ? (state.pistolHand === 0 ? -4 : 4) : 0
    if (isDualPistol) state.pistolHand = state.pistolHand === 0 ? 1 : 0
    const cx = player.x + player.w / 2 + (player.facing > 0 ? ARM_ANCHOR_X : -ARM_ANCHOR_X)
    const cy = player.y + player.h / 2 + ARM_ANCHOR_Y + handOffset
    const baseAngle = Math.atan2(aimWorldY - cy, aimWorldX - cx)
    const armLength = 68 - ARM_PIVOT_X
    const ws = weaponSprites[state.currentWeapon]
    const targetH = 12
    const gunDist = armLength + (ws?.loaded ? ws.w * (targetH / ws.h) : 14) - 2

    for (let p = 0; p < weapon.pellets; p++) {
      const spreadAngle = baseAngle + (Math.random() - 0.5) * weapon.spread * 2
      const bx = cx + Math.cos(baseAngle) * gunDist
      const by = cy + Math.sin(baseAngle) * gunDist

      const bullet = {
        x: bx, y: by,
        vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
        vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
        owner: 'player' as const,
        life: BULLET_LIFE,
        trail: [] as { x: number; y: number }[],
        damage: weapon.damage,
        penetrate: state.currentWeapon === 'sniper',
      }
      state.bullets.push(bullet)
      queueBulletSync(bullet)
    }
    spawnMuzzleFlash(cx + Math.cos(baseAngle) * gunDist, cy + Math.sin(baseAngle) * gunDist, baseAngle)
    // Shell casing
    SFX.shellCasing()
    const shellAngle = baseAngle + (player.facing > 0 ? -Math.PI / 2 : Math.PI / 2)
    state.shellCasings.push({
      x: cx, y: cy,
      vx: Math.cos(shellAngle) * (60 + Math.random() * 40),
      vy: -80 - Math.random() * 60,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 20,
      life: 1.5,
    })
    state.screenShake = weapon.shake
    // Recoil — push player opposite to aim (only affects camera, not movement)
    state.camera.x -= Math.cos(baseAngle) * weapon.shake * 1.5
    state.camera.y -= Math.sin(baseAngle) * weapon.shake * 1.5
    // Weapon sound
    if (state.currentWeapon === 'pistol') SFX.pistolShot()
    else if (state.currentWeapon === 'shotgun') SFX.shotgunShot()
    else if (state.currentWeapon === 'm16') SFX.m16Shot()
    else if (state.currentWeapon === 'sniper') SFX.sniperShot()
    } // close else (non-grenade weapons)
  }

  } // close player alive check

  // ── Enemies ──
  const serverAuth = isServerAuthoritative()
  for (const e of state.enemies) {
    e.animTimer += gameDt
    if (e.hitTimer > 0) e.hitTimer -= gameDt

    if (e.state === 'dead') {
      e.deathTimer -= gameDt
      if (!serverAuth) resolvePhysics(e, gameDt)
      continue
    }

    // Server-authoritative: skip all AI, positions come from server
    if (serverAuth) continue

    // Kill enemy if fallen out of map
    if (e.y > 800) {
      e.state = 'dead'
      e.deathTimer = 0.1
      state.killCount++
      continue
    }

    const cfg = ENEMY_CONFIGS[e.behavior]
    if (e.showHpTimer > 0) e.showHpTimer -= gameDt

    // Find closest alive player to target
    let targetX = player.x, targetY = player.y, targetW = player.w, targetH = player.h
    let hasTarget = false
    let closestDist = Infinity
    for (const p of state.players) {
      if (p.hp <= 0) continue
      const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y)
      if (d < closestDist) {
        closestDist = d
        targetX = p.x; targetY = p.y; targetW = p.w; targetH = p.h
        hasTarget = true
      }
    }

    // Check if target is in sight
    const dx = targetX - e.x
    const dy = targetY - e.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (!hasTarget) {
      // No alive players — go idle
      if (e.state === 'alert') { e.alertTimer -= gameDt; if (e.alertTimer <= 0) e.state = 'idle' }
    } else if (dist < cfg.sightRange) {
      e.state = 'alert'
      e.alertTimer = 3
      e.facing = dx > 0 ? 1 : -1
    } else if (e.state === 'alert') {
      e.alertTimer -= gameDt
      if (e.alertTimer <= 0) e.state = 'idle'
    }

    if (e.state === 'idle') {
      e.patrolTimer -= gameDt
      if (e.patrolTimer <= 0) {
        e.patrolDir *= -1
        e.patrolTimer = 2 + Math.random() * 3
      }
      if (e.behavior === 'drone') {
        // Drone hovers with sine wave
        e.vx = e.patrolDir * cfg.speed
        e.vy = Math.sin(state.gameTime * 3 + e.x) * 30
      } else {
        e.vx = e.patrolDir * cfg.speed
        e.facing = e.patrolDir
      }
    } else if (e.state === 'alert') {
      // Behavior-specific alert logic
      if (e.behavior === 'drone') {
        // Fly toward target but stay above
        e.vx = (dx > 0 ? 1 : -1) * cfg.speed
        const droneTargetY = targetY - 80
        e.vy = (droneTargetY - e.y) * 2
      } else if (e.behavior === 'rusher') {
        e.vx = (dx > 0 ? 1 : -1) * cfg.speed
      } else if (e.behavior === 'sniper') {
        if (dist < 300) {
          e.vx = (dx > 0 ? -1 : 1) * cfg.speed
        } else {
          e.vx = 0
        }
      } else {
        // Grunt/shotgunner — take cover when hurt
        if (e.hitTimer > 0 && e.hp < e.maxHp * 0.5) {
          // Move away from player to find cover
          e.vx = (dx > 0 ? -1 : 1) * cfg.speed * 1.5
        } else {
          e.vx = 0
        }
      }

      e.shootTimer -= gameDt
      if (e.shootTimer <= 0) {
        e.shootTimer = (cfg.shootInterval / getDifficultyMult()) * (0.8 + Math.random() * 0.4)
        const angle = Math.atan2(
          (targetY + targetH / 2) - (e.y + e.h / 2),
          (targetX + targetW / 2) - (e.x + e.w / 2)
        )
        // Fire pellets (shotgunner fires spread)
        for (let p = 0; p < cfg.pellets; p++) {
          const spreadAngle = angle + (Math.random() - 0.5) * cfg.spread * 2
          const bx = e.x + e.w / 2 + Math.cos(angle) * 16
          const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
          const eBullet = {
            x: bx, y: by,
            vx: Math.cos(spreadAngle) * cfg.bulletSpeed,
            vy: Math.sin(spreadAngle) * cfg.bulletSpeed,
            owner: 'enemy' as const,
            life: BULLET_LIFE,
            trail: [] as { x: number; y: number }[],
            damage: cfg.damage,
          }
          state.bullets.push(eBullet)
          queueBulletSync(eBullet)
        }
        const bx = e.x + e.w / 2 + Math.cos(angle) * 16
        const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
        spawnMuzzleFlash(bx, by, angle)
        // Enemy weapon sound at half volume
        const enemyWeaponSound: Record<string, () => void> = {
          grunt: () => playSound('pistol', 0.04),
          shotgunner: () => playSound('shotgun', 0.08),
          sniper: () => playSound('sniper', 0.08),
          rusher: () => playSound('m16', 0.05),
          boss: () => playSound('shotgun', 0.08),
          drone: () => playSound('pistol', 0.03),
        }
        enemyWeaponSound[e.behavior]?.()
      }
    }

    // Dodge — sniper and rusher enemies try to dodge incoming bullets
    if ((e.behavior === 'sniper' || e.behavior === 'rusher') && e.state === 'alert' && e.onGround) {
      for (const b of state.bullets) {
        if (b.owner !== 'player') continue
        const bDx = b.x - e.x - e.w / 2
        const bDy = b.y - e.y - e.h / 2
        const bDist = Math.sqrt(bDx * bDx + bDy * bDy)
        if (bDist < 80 && bDist > 10) {
          // Bullet is close — dodge perpendicular to bullet direction
          const dodgeDir = (b.vy * bDx - b.vx * bDy) > 0 ? 1 : -1
          e.vy = -250
          e.vx = dodgeDir * 150
          break
        }
      }
    }

    if (e.behavior === 'drone') {
      // Drones fly — manual position update, no gravity
      e.x += e.vx * gameDt
      e.y += e.vy * gameDt
      // Clamp to level bounds
      e.x = Math.max(20, Math.min(e.x, 2380 - e.w))
      e.y = Math.max(50, Math.min(e.y, 580))
    } else {
      resolvePhysics(e, gameDt)
    }
  }

  // ── Bullets ──
  updateBullets(gameDt)

  // ── Grenades ──
  for (let i = state.grenades.length - 1; i >= 0; i--) {
    const g = state.grenades[i]
    g.vy += GRAVITY * gameDt
    g.x += g.vx * gameDt
    g.y += g.vy * gameDt
    g.fuseTimer -= gameDt

    // Bounce off platforms and cover
    const allSolids = [...platforms, ...state.coverBoxes]
    for (const s of allSolids) {
      if (g.x >= s.x && g.x <= s.x + s.w && g.y >= s.y && g.y <= s.y + s.h) {
        // Push out and bounce
        const fromTop = g.y - s.y
        const fromBottom = s.y + s.h - g.y
        const fromLeft = g.x - s.x
        const fromRight = s.x + s.w - g.x
        const min = Math.min(fromTop, fromBottom, fromLeft, fromRight)

        if (min === fromTop || min === fromBottom) {
          g.vy = -g.vy * GRENADE_BOUNCE_DAMP
          g.y = min === fromTop ? s.y : s.y + s.h
        } else {
          g.vx = -g.vx * GRENADE_BOUNCE_DAMP
          g.x = min === fromLeft ? s.x : s.x + s.w
        }
        g.bounces++
        // Friction
        g.vx *= 0.8
      }
    }

    // Fuse trail — blinking particle
    if (Math.sin(g.fuseTimer * 20) > 0) {
      state.particles.push({
        x: g.x, y: g.y,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 20,
        life: 0.15, maxLife: 0.15,
        color: g.fuseTimer < 0.5 ? '#ff2222' : '#ffaa22',
        size: 2,
      })
    }

    // Explode
    if (g.fuseTimer <= 0) {
      // Damage enemies in radius
      for (const e of state.enemies) {
        if (e.state === 'dead') continue
        const dx = (e.x + e.w / 2) - g.x
        const dy = (e.y + e.h / 2) - g.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < GRENADE_RADIUS) {
          const falloff = 1 - dist / GRENADE_RADIUS
          const dmg = WEAPONS.grenades.damage * falloff
          e.hp -= dmg
          e.hitTimer = 0.3
          e.showHpTimer = 2
          e.vx = (dx / dist) * 200 * falloff
          e.vy = -150 * falloff
          state.floatingTexts.push({
            x: e.x + e.w / 2, y: e.y - 5,
            text: Math.round(dmg).toString(), color: '#ff8844',
            life: 0.8, maxLife: 0.8,
          })
          if (e.hp <= 0) {
            e.state = 'dead'
            state.hitPauseTimer = 0.07
            SFX.enemyDeath(e.type)
            e.deathTimer = 3
            state.killCount++
            state.killFeed.push({ text: 'EXPLOSION!', color: '#ff6622', life: 2, maxLife: 2 })
          }
        }
      }
      // Damage player if too close
      const pdx = (player.x + player.w / 2) - g.x
      const pdy = (player.y + player.h / 2) - g.y
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
      if (pdist < GRENADE_RADIUS && state.invincibleTimer <= 0) {
        const falloff = 1 - pdist / GRENADE_RADIUS
        player.hp -= 30 * falloff
        state.screenShake = 10
        state.screenFlash = 'rgba(255,0,0,0.7)'
        state.screenFlashTimer = 0.15
      }
      // Destroy cover boxes in radius
      for (let j = state.coverBoxes.length - 1; j >= 0; j--) {
        const box = state.coverBoxes[j]
        const bx = (box.x + box.w / 2) - g.x
        const by = (box.y + box.h / 2) - g.y
        if (Math.sqrt(bx * bx + by * by) < GRENADE_RADIUS * 0.7) {
          spawnParticles(box.x + box.w / 2, box.y + box.h / 2, 10, '#aa8855', 150)
          state.coverBoxes.splice(j, 1)
        }
      }
      // Big explosion effects
      spawnParticles(g.x, g.y, 30, '#ff6622', 300)
      spawnParticles(g.x, g.y, 15, '#ffcc44', 200)
      spawnExplosionLight(g.x, g.y)
      SFX.explosion()
      state.screenShake = 12
      state.grenades.splice(i, 1)
    }
  }

  // ── Particles ──
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.x += p.vx * gameDt
    p.y += p.vy * gameDt
    p.vy += 400 * gameDt
    p.life -= gameDt
    if (p.life <= 0) state.particles.splice(i, 1)
  }

  // ── Shell Casings ──
  for (let i = state.shellCasings.length - 1; i >= 0; i--) {
    const s = state.shellCasings[i]
    s.x += s.vx * gameDt
    s.y += s.vy * gameDt
    s.vy += GRAVITY * 0.5 * gameDt
    s.rotation += s.rotSpeed * gameDt
    s.life -= gameDt
    if (s.life <= 0) state.shellCasings.splice(i, 1)
  }

  // ── Health Pickups ──
  updateHealthPickups(gameDt)

  // ── Floating Texts ──
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i]
    ft.y -= 40 * gameDt
    ft.life -= gameDt
    if (ft.life <= 0) state.floatingTexts.splice(i, 1)
  }

  // ── Combo Timer ──
  if (state.comboTimer > 0) {
    state.comboTimer -= gameDt
    if (state.comboTimer <= 0) state.comboCount = 0
  }

  // ── Multi-kill Timer ──
  if (state.multiKillTimer > 0) {
    state.multiKillTimer -= dt
    if (state.multiKillTimer <= 0) state.multiKillCount = 0
  }

  // ── Kill Feed ──
  for (let i = state.killFeed.length - 1; i >= 0; i--) {
    state.killFeed[i].life -= dt
    if (state.killFeed[i].life <= 0) state.killFeed.splice(i, 1)
  }

  // ── Hit Marker ──
  if (state.hitMarkerTimer > 0) state.hitMarkerTimer -= dt

  // ── Screen Flash ──
  if (state.screenFlashTimer > 0) state.screenFlashTimer -= dt

  // ── Kill Cam ──
  if (state.killCamActive) {
    state.killCamTimer -= dt
    if (state.killCamTimer <= 0) state.killCamActive = false
  }

  // ── Death Slow-mo ──
  if (state.deathSlowMo) {
    state.deathSlowMoTimer -= dt
    if (state.deathSlowMoTimer <= 0) state.deathSlowMo = false
  }

  // ── Ammo Pickups ──
  updateAmmoPickups(gameDt)

  // ── Score Multiplier ──
  if (state.shotsFired > 0) {
    const accuracy = state.shotsHit / state.shotsFired
    state.scoreMultiplier = 0.5 + accuracy * 1.5 // 0.5x at 0% accuracy, 2.0x at 100%
  }

  // ── Falling cover boxes ──
  for (let i = state.coverBoxes.length - 1; i >= 0; i--) {
    const box = state.coverBoxes[i]
    if (!box.falling) continue
    box.vy = (box.vy ?? 0) + GRAVITY * gameDt
    box.y += box.vy * gameDt
    // Land on platforms
    for (const p of platforms) {
      if (box.x + box.w > p.x && box.x < p.x + p.w &&
          box.y + box.h >= p.y && box.y + box.h <= p.y + box.vy * gameDt + 4) {
        box.y = p.y - box.h
        box.vy = 0
        box.falling = false
        break
      }
    }
    // Remove if fallen off screen
    if (box.y > 900) {
      state.coverBoxes.splice(i, 1)
    }
  }

  // ── Explosive barrel chain reactions ──
  for (let i = state.coverBoxes.length - 1; i >= 0; i--) {
    const box = state.coverBoxes[i]
    if (box.hp <= 0 && box.type === 'explosive') {
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      SFX.explosion()
      spawnParticles(cx, cy, 30, '#ff4400', 350)
      spawnParticles(cx, cy, 15, '#ffcc00', 250)
      spawnExplosionLight(cx, cy)
      state.screenShake = 15
      state.hitPauseTimer = 0.06
      const radius = 120
      for (const e of state.enemies) {
        if (e.state === 'dead') continue
        const edx = (e.x + e.w / 2) - cx
        const edy = (e.y + e.h / 2) - cy
        const dist = Math.sqrt(edx * edx + edy * edy)
        if (dist < radius) {
          const falloff = 1 - dist / radius
          e.hp -= 60 * falloff
          e.vy = -150 * falloff
          e.showHpTimer = 2
          if (e.hp <= 0) {
            e.state = 'dead'
            SFX.enemyDeath(e.type)
            e.deathTimer = 3
            state.killCount++
          }
        }
      }
      const pdx = (player.x + player.w / 2) - cx
      const pdy = (player.y + player.h / 2) - cy
      const pDist = Math.sqrt(pdx * pdx + pdy * pdy)
      if (pDist < radius && state.invincibleTimer <= 0) {
        player.hp -= 25 * (1 - pDist / radius)
        player.vy = -200 * (1 - pDist / radius)
      }
      // Chain to other boxes
      for (const other of state.coverBoxes) {
        if (other === box) continue
        const odx = (other.x + other.w / 2) - cx
        const ody = (other.y + other.h / 2) - cy
        if (Math.sqrt(odx * odx + ody * ody) < radius) {
          other.hp -= 40 * (1 - Math.sqrt(odx * odx + ody * ody) / radius)
        }
      }
      state.coverBoxes.splice(i, 1)
    } else if (box.hp <= 0) {
      // Non-explosive box destroyed by chain damage
      spawnParticles(box.x + box.w / 2, box.y + box.h / 2, 10, '#aa8855', 150)
      state.coverBoxes.splice(i, 1)
    }
  }

  // ── Light Flashes ──
  for (let i = state.lightFlashes.length - 1; i >= 0; i--) {
    state.lightFlashes[i].intensity -= dt * 8
    if (state.lightFlashes[i].intensity <= 0) state.lightFlashes.splice(i, 1)
  }

  // ── Thunder ──
  state.thunderTimer -= dt
  if (state.thunderFlash > 0) state.thunderFlash -= dt
  if (state.thunderTimer <= 0) {
    state.thunderFlash = 0.15
    state.screenShake = Math.max(state.screenShake, 4)
    SFX.thunder()
    state.thunderTimer = 10 + Math.random() * 25
  }

  // ── Rain ──
  if (state.raindrops.length < 80) {
    state.raindrops.push({
      x: state.camera.x + Math.random() * 1400 - 60,
      y: state.camera.y - 20,
      speed: 400 + Math.random() * 200,
      length: 6 + Math.random() * 8,
    })
  }
  for (let i = state.raindrops.length - 1; i >= 0; i--) {
    const r = state.raindrops[i]
    r.y += r.speed * gameDt
    r.x += 30 * gameDt // slight wind

    // Check if raindrop hit a platform or cover box
    let hitSurface = false
    const allSurfaces = [...platforms, ...state.coverBoxes]
    for (const s of allSurfaces) {
      if (r.x >= s.x && r.x <= s.x + s.w && r.y >= s.y && r.y <= s.y + 4) {
        // Splash particles
        for (let j = 0; j < 2; j++) {
          state.particles.push({
            x: r.x,
            y: s.y,
            vx: (Math.random() - 0.5) * 30,
            vy: -15 - Math.random() * 20,
            life: 0.1 + Math.random() * 0.1,
            maxLife: 0.15,
            color: '#8899bb',
            size: 1 + Math.random(),
          })
        }
        hitSurface = true
        break
      }
    }

    if (hitSurface || r.y > state.camera.y + 720) {
      state.raindrops.splice(i, 1)
    }
  }

  // ── Ambient ──
  updateAmbient(dt, gameDt)

  // ── Camera ──
  updateCamera(dt)

  // Wave system — server handles this when online
  if (!serverAuth) {
    if (state.waveState === 'countdown') {
      state.waveTimer -= dt
      if (state.waveTimer <= 0) {
        startWave()
      }
    } else if (state.waveState === 'active') {
      const alive = state.enemies.filter(e => e.state !== 'dead').length

      // Reinforcement drops — on wave 6+ when half enemies are dead
      if (state.wave >= 6 && alive > 0 && alive <= Math.floor(state.waveEnemiesAlive / 2)) {
        if (!state.reinforcementsSent) {
          state.reinforcementsSent = true
          const reinforceCount = 1 + Math.floor(state.wave / 4)
          const behaviors: EnemyBehavior[] = ['grunt', 'rusher', 'drone']
          for (let r = 0; r < reinforceCount; r++) {
            const rx = 200 + Math.random() * 2000
            const behavior = behaviors[Math.floor(Math.random() * behaviors.length)]
            // Spawn high up — they'll fall in
            spawnEnemy(rx, behavior === 'drone' ? 50 : -50, behavior)
          }
          state.killFeed.push({ text: 'REINFORCEMENTS!', color: '#ff4466', life: 2.5, maxLife: 2.5 })
        }
      }

      if (alive === 0) {
        state.waveState = 'cleared'
        SFX.waveCleared()
        state.waveTimer = 4
        state.totalScore += Math.round((state.killCount * 10 + state.wave * 50) * state.scoreMultiplier)
        for (const wp of state.weaponPickups) wp.collected = false
        player.hp = Math.min(PLAYER_MAX_HP, player.hp + 15)
      }
    } else if (state.waveState === 'cleared') {
      state.waveTimer -= dt
      if (state.waveTimer <= 3.5 && state.bulletTimeToggled) {
        state.bulletTimeToggled = false
        player.bulletTimeActive = false
      }
      if (state.waveTimer <= 0) {
        state.enemies.length = 0
        state.bloodDecals.length = 0
        spawnAmbientObjects()
        state.waveState = 'countdown'
        state.waveTimer = 3
      }
    }
  }

  // ─── Multiplayer sync ───────────────────────────────────────────────────────
  sendPlayerState()
  updateRemotePlayer(dt)
  syncGameEvents()
}
