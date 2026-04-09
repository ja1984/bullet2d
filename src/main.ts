// ─── Main Entry Point ────────────────────────────────────────────────────────

import { BULLET_TIME_MAX, CANVAS_W, CANVAS_H, PLAYER_MAX_HP, WEAPONS } from './constants'
import { state } from './state'
import { setupInput } from './input'
import { loadPlayerSprites } from './sprites/playerSprites'
import { loadEnemySprites } from './sprites/enemySprites'
import { loadWeaponSprites } from './sprites/weaponSprites'
import { setupDebug } from './debug'
import { spawnAmbientObjects } from './systems/ambient'
import { generateLevel, populateLevel } from './systems/levelgen'
import { setGeneratedLevel } from './constants'
import { update } from './update'
import { render, renderTitleScreen } from './rendering/renderer'
import { createMultiplayerMenu, showMultiplayerMenu, hideMultiplayerMenu } from './ui/multiplayerMenu'

// ─── Canvas Setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = CANVAS_W
canvas.height = CANVAS_H
state.ctx = ctx

// ─── Init ────────────────────────────────────────────────────────────────────

setupInput(canvas)
setupDebug()
loadPlayerSprites()
loadEnemySprites('grunt', {
  idle: { frames: 4, fps: 6 },
  walk: { frames: 6, fps: 10 },
  hit:   { frames: 9, fps: 28 },
  death: { frames: 10, fps: 16 },
})
loadEnemySprites('thug', {
  idle: { frames: 4, fps: 6 },
  walk: { frames: 6, fps: 10 },
  hit:   { frames: 10, fps: 28 },
  death: { frames: 10, fps: 16 },
})
loadWeaponSprites()

// Init multiplayer menu
createMultiplayerMenu()
// Players array: index 0 is always the local player
state.players = [state.player]

const initLevel = generateLevel(1)
setGeneratedLevel(initLevel.platforms, initLevel.spawnPositions)
populateLevel(initLevel.platforms, 1)
spawnAmbientObjects()

// ─── Restart ─────────────────────────────────────────────────────────────────

export function restart() {
  const player = state.player
  player.x = 100; player.y = 500
  player.vx = 0; player.vy = 0
  player.hp = PLAYER_MAX_HP
  player.diving = false; player.diveTimer = 0
  player.crouching = false; player.rolling = false; player.rollTimer = 0
  player.h = player.standingH
  player.jumpCount = 0
  player.doubleJumping = false
  player.doubleJumpSpin = 0
  player.jumpHoldTime = 0
  player.jumpWasReleased = true
  player.landingTimer = 0
  player.wallSliding = false
  player.wallDir = 0
  player.wallJumpCooldown = 0
  player.bulletTimeEnergy = BULLET_TIME_MAX
  player.bulletTimeActive = false
  player.hitFlash = 0
  state.bullets.length = 0
  state.particles.length = 0
  state.enemies.length = 0
  state.healthPickups.length = 0
  state.ammoPickups.length = 0
  state.floatingTexts.length = 0
  state.shellCasings.length = 0
  state.bloodDecals.length = 0
  state.comboCount = 0
  state.comboTimer = 0
  state.hitMarkerTimer = 0
  state.killFeed.length = 0
  state.multiKillCount = 0
  state.multiKillTimer = 0
  state.shotsFired = 0
  state.shotsHit = 0
  state.scoreMultiplier = 1.0
  state.raindrops.length = 0
  state.lightFlashes.length = 0
  const restartLevel = generateLevel(1)
  setGeneratedLevel(restartLevel.platforms, restartLevel.spawnPositions)
  populateLevel(restartLevel.platforms, 1)
  spawnAmbientObjects()
  state.killCount = 0
  state.totalScore = 0
  state.wave = 0
  state.waveState = 'countdown'
  state.waveTimer = 3
  state.gameOver = false
  state.deathSlowMo = false
  state.deathSlowMoTimer = 0
  state.killCamActive = false
  state.killCamTimer = 0
  state.screenFlash = ''
  state.screenFlashTimer = 0
  state.currentWeapon = 'pistol'
  player.reloading = false
  player.reloadTimer = 0
  state.playerAmmo.pistol = -1
  state.playerAmmo.shotgun = 0
  state.playerAmmo.m16 = 0
  state.playerAmmo.sniper = 0
  state.playerAmmo.grenades = 3
  state.magRounds.pistol = WEAPONS.pistol.magSize
  state.magRounds.shotgun = WEAPONS.shotgun.magSize
  state.magRounds.m16 = WEAPONS.m16.magSize
  state.magRounds.sniper = WEAPONS.sniper.magSize
  state.magRounds.grenades = WEAPONS.grenades.magSize
  state.grenades.length = 0
  for (const wp of state.weaponPickups) wp.collected = false
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

let lastTime = 0

function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05) // cap delta
  lastTime = timestamp

  if (state.gameState === 'title') {
    state.gameTime += dt
    renderTitleScreen()
    showMultiplayerMenu()
  } else if (state.gameState === 'paused') {
    hideMultiplayerMenu()
    render() // still render the game behind the pause overlay
  } else {
    hideMultiplayerMenu()
    update(dt)
    render()
  }
  requestAnimationFrame(gameLoop)
}

requestAnimationFrame((t) => {
  lastTime = t
  gameLoop(t)
})
