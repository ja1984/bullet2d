// ─── Co-op Player 2 System ────────────────────────────────────────────────────

import { PLAYER_SPEED, PLAYER_JUMP, DIVE_SPEED, DIVE_DURATION, WEAPONS, BULLET_LIFE, CANVAS_W, platforms, spriteConfig } from '../constants'
import type { WeaponType } from '../types'
import { state, PlayerState } from '../state'
import { pollGamepad, GamepadInput } from './gamepad'
import { resolvePhysics } from './physics'
import { spawnMuzzleFlash, spawnParticles } from './particles'
import { SFX, playSound } from '../audio'
import { getAvailableWeapons, switchWeapon } from '../input'
import type { GuestInputPacket } from './network'
import { isOnline } from './network'

let lastGamepadInput: GamepadInput | null = null
let p2AimWorldX = 0
let p2AimWorldY = 0
let networkInput: GuestInputPacket | null = null
let latestNetworkInput: GuestInputPacket | null = null // persists between frames

export function getP2Aim() { return { x: p2AimWorldX, y: p2AimWorldY } }

export function setNetworkInput(input: GuestInputPacket) {
  networkInput = input
  latestNetworkInput = input
}

export function updatePlayer2(dt: number, gameDt: number) {
  if (!state.coopEnabled || state.players.length < 2) return

  // In online mode, P2 is driven by network — skip local update
  if (isOnline()) return

  const p2 = state.players[1]

  // Use network input if available, otherwise gamepad
  let input: GamepadInput
  const ni = networkInput // fresh packet this frame (for one-shot events)
  const held = latestNetworkInput // latest known held state (persists)
  networkInput = null // consume fresh packet

  if (held) {
    input = {
      moveX: held.moveX,
      moveY: held.moveY,
      aimX: held.aimX,
      aimY: held.aimY,
      // One-shot events only from fresh packet
      jump: ni?.jump ?? false,
      jumpHeld: held.jumpHeld,
      shoot: ni?.shoot ?? false,
      shootHeld: held.shootHeld,
      bulletTime: ni?.bulletTime ?? false,
      reload: ni?.reload ?? false,
      crouch: held.crouch,
      dive: ni?.dive ?? false,
      weaponNext: ni?.weaponNext ?? false,
      weaponPrev: ni?.weaponPrev ?? false,
      connected: true,
    }
  } else {
    input = pollGamepad(dt)
  }
  lastGamepadInput = input

  if (!input.connected) return

  // Movement
  const moveSpeed = p2.crouching ? PLAYER_SPEED * 0.4 : PLAYER_SPEED

  if (!p2.diving) {
    p2.vx = 0
    if (input.moveX < -0.3) p2.vx = -moveSpeed
    if (input.moveX > 0.3) p2.vx = moveSpeed

    if (p2.onGround) {
      p2.jumpCount = 0
      p2.doubleJumping = false
      p2.wasAirborne = false
      p2.jumpHoldTime = 0
      if (!input.jumpHeld) p2.jumpWasReleased = true
    }

    if (!input.jumpHeld) {
      p2.jumpWasReleased = true
      // Cut jump short when releasing
      if (p2.vy < 0 && p2.jumpHoldTime > 0) {
        p2.vy *= 0.5
        p2.jumpHoldTime = 0
      }
      if (p2.doubleJumping) {
        p2.doubleJumping = false
        p2.doubleJumpSpin = 0
      }
    }

    // Start jump on fresh press
    if (input.jump && p2.jumpWasReleased && p2.jumpCount < 2) {
      if (p2.onGround || p2.jumpCount === 1) {
        const jumpForce = p2.jumpCount === 0 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
        p2.vy = jumpForce * 0.6
        p2.jumpHoldTime = gameDt
        if (p2.jumpCount === 1) {
          p2.doubleJumping = true
          p2.doubleJumpSpin = 0
        }
        p2.jumpCount++
        p2.wasAirborne = true
        p2.jumpWasReleased = false
      }
    }

    // Variable jump height — keep adding force while holding
    if (input.jumpHeld && !p2.jumpWasReleased && p2.jumpHoldTime > 0 && p2.jumpHoldTime < p2.jumpMaxHold) {
      p2.jumpHoldTime += gameDt
      const jumpForce = p2.jumpCount === 1 ? -PLAYER_JUMP : -PLAYER_JUMP * 0.85
      p2.vy = jumpForce * (0.6 + 0.4 * (p2.jumpHoldTime / p2.jumpMaxHold))
    }

    // Crouch
    if (input.crouch && p2.onGround && !p2.crouching) {
      p2.crouching = true
      p2.y += p2.standingH - p2.crouchH
      p2.h = p2.crouchH
    } else if (!input.crouch && p2.crouching) {
      p2.crouching = false
      p2.y -= p2.standingH - p2.crouchH
      p2.h = p2.standingH
    }

    // Dive
    if (input.dive && !p2.rolling) {
      const diveDir = input.moveX > 0 ? 1 : -1
      if (p2.crouching) {
        p2.rolling = true
        p2.rollTimer = 0.4
        p2.rollDir = diveDir
        p2.vx = DIVE_SPEED * 1.2 * diveDir
      } else {
        p2.diving = true
        p2.diveTimer = DIVE_DURATION
        p2.diveDir = diveDir
        p2.vx = DIVE_SPEED * diveDir
        p2.vy = p2.onGround ? -120 : -80
      }
    }
  } else {
    p2.diveTimer -= gameDt
    if (p2.diveTimer <= 0) {
      p2.diving = false
    } else if (p2.onGround) {
      p2.vx = p2.diveDir * DIVE_SPEED * 0.5
    }
    // Jump cancels dive
    if (input.jump && p2.jumpWasReleased && p2.onGround) {
      p2.diving = false
      p2.vy = -PLAYER_JUMP * 0.6
      p2.jumpCount = 1
      p2.wasAirborne = true
      p2.jumpWasReleased = false
    }
  }

  // Roll update
  if (p2.rolling) {
    p2.rollTimer -= gameDt
    p2.vx = DIVE_SPEED * 1.2 * p2.rollDir * (p2.rollTimer / 0.4)
    if (p2.rollTimer <= 0) p2.rolling = false
  }

  // Facing — based on aim direction, mouse, or movement
  if (held && (held.mouseX !== 0 || held.mouseY !== 0)) {
    p2.facing = held.mouseX >= p2.x + p2.w / 2 ? 1 : -1
  } else if (Math.abs(input.aimX) > 0.3 || Math.abs(input.aimY) > 0.3) {
    p2.facing = input.aimX >= 0 ? 1 : -1
  } else if (Math.abs(p2.vx) > 5) {
    p2.facing = p2.vx > 0 ? 1 : -1
  }

  // Physics
  resolvePhysics(p2, gameDt)

  // Clamp inside level bounds
  if (p2.x < 20) p2.x = 20
  if (p2.x + p2.w > 2380) p2.x = 2380 - p2.w

  // Fall death
  if (p2.y > 800) {
    p2.hp = 0
  }

  // Shooting — right stick or mouse aiming + RT
  p2.shootCooldown -= dt
  const weapon = WEAPONS[p2.currentWeapon as WeaponType]
  const hasStickAim = Math.abs(input.aimX) > 0.3 || Math.abs(input.aimY) > 0.3
  const hasMouseAim = held && (held.mouseX !== 0 || held.mouseY !== 0)
  let aimAngle: number
  if (hasMouseAim) {
    // Mouse aim from network guest
    const mx = held!.mouseX
    const my = held!.mouseY
    aimAngle = Math.atan2(my - (p2.y + p2.h / 2 - 4), mx - (p2.x + p2.w / 2))
    p2AimWorldX = mx
    p2AimWorldY = my
  } else if (hasStickAim) {
    aimAngle = Math.atan2(input.aimY, input.aimX)
    const aimDist = 100
    p2AimWorldX = p2.x + p2.w / 2 + Math.cos(aimAngle) * aimDist
    p2AimWorldY = p2.y + p2.h / 2 - 4 + Math.sin(aimAngle) * aimDist
  } else {
    aimAngle = p2.facing > 0 ? 0 : Math.PI
    const aimDist = 100
    p2AimWorldX = p2.x + p2.w / 2 + Math.cos(aimAngle) * aimDist
    p2AimWorldY = p2.y + p2.h / 2 - 4 + Math.sin(aimAngle) * aimDist
  }

  const canShoot = weapon.auto ? input.shootHeld : input.shoot
  if (canShoot && p2.shootCooldown <= 0 && !p2.reloading) {
    if (p2.magRounds[p2.currentWeapon] <= 0) {
      SFX.emptyClick()
      p2.reloading = true
      p2.reloadTimer = weapon.reloadTime
    } else {
      p2.magRounds[p2.currentWeapon]--
      p2.shootCooldown = weapon.fireRate

      const cx = p2.x + p2.w / 2
      const cy = p2.y + p2.h / 2 - 4
      for (let i = 0; i < weapon.pellets; i++) {
        const spread = (Math.random() - 0.5) * weapon.spread * 2
        state.bullets.push({
          x: cx + Math.cos(aimAngle) * 16,
          y: cy + Math.sin(aimAngle) * 16,
          vx: Math.cos(aimAngle + spread) * weapon.bulletSpeed,
          vy: Math.sin(aimAngle + spread) * weapon.bulletSpeed,
          owner: 'player',
          life: BULLET_LIFE,
          trail: [],
          damage: weapon.damage,
        })
      }
      spawnMuzzleFlash(cx + Math.cos(aimAngle) * 16, cy + Math.sin(aimAngle) * 16, aimAngle)
      state.screenShake = Math.max(state.screenShake, weapon.shake * 0.5)

      // Auto-reload when mag empties
      if (p2.magRounds[p2.currentWeapon] <= 0) {
        const hasAmmo = p2.playerAmmo[p2.currentWeapon] === -1 || p2.playerAmmo[p2.currentWeapon] > 0
        if (hasAmmo) {
          p2.reloading = true
          p2.reloadTimer = weapon.reloadTime
        }
      }
    }
  }

  // Reload
  if (p2.reloading) {
    p2.reloadTimer -= dt
    if (p2.reloadTimer <= 0) {
      p2.reloading = false
      const ammo = p2.playerAmmo[p2.currentWeapon]
      if (ammo === -1) {
        p2.magRounds[p2.currentWeapon] = weapon.magSize
      } else {
        const needed = weapon.magSize - p2.magRounds[p2.currentWeapon]
        const loaded = Math.min(needed, ammo)
        p2.magRounds[p2.currentWeapon] += loaded
        p2.playerAmmo[p2.currentWeapon] -= loaded
      }
    }
  }

  if (input.reload && !p2.reloading) {
    const hasReserves = p2.playerAmmo[p2.currentWeapon] === -1 || p2.playerAmmo[p2.currentWeapon] > 0
    if (p2.magRounds[p2.currentWeapon] < weapon.magSize && hasReserves) {
      p2.reloading = true
      p2.reloadTimer = weapon.reloadTime
    }
  }

  // Weapon switching — P2's own available weapons
  if (input.weaponNext || input.weaponPrev) {
    const allWeapons: WeaponType[] = ['pistol', 'shotgun', 'm16', 'sniper', 'grenades']
    const available = allWeapons.filter(w => p2.playerAmmo[w] === -1 || p2.playerAmmo[w] > 0)
    if (available.length > 1) {
      const idx = available.indexOf(p2.currentWeapon)
      const next = input.weaponNext
        ? available[(idx + 1) % available.length]
        : available[(idx - 1 + available.length) % available.length]
      if (next !== p2.currentWeapon) {
        p2.currentWeapon = next
        p2.reloading = false
        p2.reloadTimer = 0
      }
    }
  }

  // Hit flash decay
  if (p2.hitFlash > 0) p2.hitFlash -= dt

  // Check if both players dead
  if (state.players.every(p => p.hp <= 0) && !state.gameOver) {
    state.gameOver = true
    state.deathSlowMo = true
    state.deathSlowMoTimer = 2.0
    SFX.stopAmbient()
  }
}

export function getLastGamepadInput(): GamepadInput | null {
  return lastGamepadInput
}
