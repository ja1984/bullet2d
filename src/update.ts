// ─── Update ──────────────────────────────────────────────────────────────────

import {
  BULLET_LIFE, BULLET_TIME_MAX, BULLET_TIME_RECHARGE, BULLET_TIME_SCALE,
  DIVE_DURATION, DIVE_SPEED, ENEMY_CONFIGS, GRAVITY, PLAYER_JUMP,
  PLAYER_MAX_HP, PLAYER_SPEED, WEAPONS, DOUBLE_TAP_WINDOW, CANVAS_W, spriteConfig,
  ARM_ANCHOR_X, ARM_ANCHOR_Y, ARM_PIVOT_X,
} from './constants'
import { state } from './state'
import { SFX } from './audio'
import { getPlayerAnim } from './sprites/playerSprites'
import { weaponSprites } from './sprites/weaponSprites'
import { resolvePhysics } from './systems/physics'
import { spawnMuzzleFlash } from './systems/particles'
import { updateBullets } from './systems/bullets'
import { updateWeaponPickups, updateHealthPickups, updateAmmoPickups } from './systems/pickups'
import { startWave, spawnCoverBoxes, getDifficultyMult } from './systems/waves'
import { updateCamera } from './systems/camera'
import { restart } from './main'

export function update(dt: number) {
  state.gameTime += dt

  if (state.gameOver) {
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
    if (state.keys['KeyR']) restart()
    return
  }

  // Bullet time (toggle on Shift press)
  const shiftDown = state.keys['ShiftRight'] || state.keys['ShiftLeft']
  if (shiftDown && state.shiftWasUp) {
    state.bulletTimeToggled = !state.bulletTimeToggled
    if (state.bulletTimeToggled) SFX.bulletTimeOn()
    else SFX.bulletTimeOff()
  }
  state.shiftWasUp = !shiftDown

  if (state.bulletTimeToggled && state.player.bulletTimeEnergy > 0) {
    state.player.bulletTimeActive = true
    // state.player.bulletTimeEnergy -= dt // DEBUG: infinite bullet time
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

    const jumpPressed = state.keys['KeyW'] || state.keys['ArrowUp'] || state.keys['Space']

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
  }

  // Roll update
  if (player.rolling) {
    player.rollTimer -= gameDt
    player.vx = DIVE_SPEED * 1.2 * player.rollDir * (player.rollTimer / 0.4)
    if (player.rollTimer <= 0) {
      player.rolling = false
    }
  }

  resolvePhysics(player, gameDt)

  // ── Weapon Pickups ──
  updateWeaponPickups(dt)

  // ── Shooting ──
  const weapon = WEAPONS[state.currentWeapon]
  player.shootCooldown -= dt

  // Reload logic
  if (player.reloading) {
    player.reloadTimer -= dt
    if (player.reloadTimer <= 0) {
      player.reloading = false
      state.magRounds[state.currentWeapon] = weapon.magSize
    }
  }

  // Manual reload with R
  if (state.keys['KeyR'] && !player.reloading && state.magRounds[state.currentWeapon] < weapon.magSize) {
    player.reloading = true
    player.reloadTimer = weapon.reloadTime
    SFX.reload()
    state.keys['KeyR'] = false
  }

  const canShoot = weapon.auto ? state.mouseDown : state.mouseClicked
  state.mouseClicked = false
  if (canShoot && player.shootCooldown <= 0 && !player.reloading) {
    // Check mag
    if (state.magRounds[state.currentWeapon] <= 0) {
      // Auto reload when mag empty
      player.reloading = true
      player.reloadTimer = weapon.reloadTime
      return
    }
    state.magRounds[state.currentWeapon]--

    player.shootCooldown = weapon.fireRate
    const cx = player.x + player.w / 2 + (player.facing > 0 ? ARM_ANCHOR_X : -ARM_ANCHOR_X)
    const cy = player.y + player.h / 2 + ARM_ANCHOR_Y
    const baseAngle = Math.atan2(aimWorldY - cy, aimWorldX - cx)
    const armLength = 68 - ARM_PIVOT_X
    const ws = weaponSprites[state.currentWeapon]
    const targetH = 12
    const gunDist = armLength + (ws?.loaded ? ws.w * (targetH / ws.h) : 14) - 2

    for (let p = 0; p < weapon.pellets; p++) {
      const spreadAngle = baseAngle + (Math.random() - 0.5) * weapon.spread * 2
      const bx = cx + Math.cos(baseAngle) * gunDist
      const by = cy + Math.sin(baseAngle) * gunDist

      state.bullets.push({
        x: bx, y: by,
        vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
        vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
        owner: 'player',
        life: BULLET_LIFE,
        trail: [],
        damage: weapon.damage,
      })
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
  }

  // ── Enemies ──
  for (const e of state.enemies) {
    e.animTimer += gameDt
    if (e.hitTimer > 0) e.hitTimer -= gameDt

    if (e.state === 'dead') {
      e.deathTimer -= gameDt
      resolvePhysics(e, gameDt)
      continue
    }

    const cfg = ENEMY_CONFIGS[e.behavior]
    if (e.showHpTimer > 0) e.showHpTimer -= gameDt

    // Check if player is in sight
    const dx = player.x - e.x
    const dy = player.y - e.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < cfg.sightRange) {
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
      e.vx = e.patrolDir * cfg.speed
      e.facing = e.patrolDir
    } else if (e.state === 'alert') {
      // Behavior-specific alert logic
      if (e.behavior === 'rusher') {
        // Rush toward player
        e.vx = (dx > 0 ? 1 : -1) * cfg.speed
      } else if (e.behavior === 'sniper') {
        // Keep distance — back away if too close
        if (dist < 300) {
          e.vx = (dx > 0 ? -1 : 1) * cfg.speed
        } else {
          e.vx = 0
        }
      } else {
        e.vx = 0
      }

      e.shootTimer -= gameDt
      if (e.shootTimer <= 0) {
        e.shootTimer = (cfg.shootInterval / getDifficultyMult()) * (0.8 + Math.random() * 0.4)
        const angle = Math.atan2(
          (player.y + player.h / 2) - (e.y + e.h / 2),
          (player.x + player.w / 2) - (e.x + e.w / 2)
        )
        // Fire pellets (shotgunner fires spread)
        for (let p = 0; p < cfg.pellets; p++) {
          const spreadAngle = angle + (Math.random() - 0.5) * cfg.spread * 2
          const bx = e.x + e.w / 2 + Math.cos(angle) * 16
          const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
          state.bullets.push({
            x: bx, y: by,
            vx: Math.cos(spreadAngle) * cfg.bulletSpeed,
            vy: Math.sin(spreadAngle) * cfg.bulletSpeed,
            owner: 'enemy',
            life: BULLET_LIFE,
            trail: [],
            damage: cfg.damage,
          })
        }
        const bx = e.x + e.w / 2 + Math.cos(angle) * 16
        const by = e.y + e.h / 2 - 4 + Math.sin(angle) * 16
        spawnMuzzleFlash(bx, by, angle)
      }
    }

    resolvePhysics(e, gameDt)
  }

  // ── Bullets ──
  updateBullets(gameDt)

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

  // ── Camera ──
  updateCamera(dt)

  // Wave system
  if (state.waveState === 'countdown') {
    state.waveTimer -= dt
    if (state.waveTimer <= 0) {
      startWave()
    }
  } else if (state.waveState === 'active') {
    const alive = state.enemies.filter(e => e.state !== 'dead').length
    if (alive === 0) {
      state.waveState = 'cleared'
      SFX.waveCleared()
      state.waveTimer = 4 // time to show score screen
      // Score: base kills + combo bonus + wave bonus
      state.totalScore += state.killCount * 10 + state.wave * 50
      // Respawn weapon pickups
      for (const wp of state.weaponPickups) wp.collected = false
      // Heal player slightly between waves
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 15)
    }
  } else if (state.waveState === 'cleared') {
    state.waveTimer -= dt
    if (state.waveTimer <= 0) {
      state.enemies.length = 0
      state.bloodDecals.length = 0
      spawnCoverBoxes()
      state.waveState = 'countdown'
      state.waveTimer = 3
    }
  }
}
