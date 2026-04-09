// ─── Debug Panel ─────────────────────────────────────────────────────────────

import type { EnemyBehavior } from './types'
import { LEVELS, PLAYER_MAX_HP, BULLET_TIME_MAX, WEAPONS, setLevel } from './constants'
import { state } from './state'
import { spawnEnemy, spawnCoverBoxes } from './systems/waves'
import { SFX } from './audio'

let debugOpen = false

export function setupDebug() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault()
      debugOpen = !debugOpen
      const panel = document.getElementById('debug-panel')
      if (panel) panel.style.display = debugOpen ? 'block' : 'none'
    }
  })

  const panel = document.createElement('div')
  panel.id = 'debug-panel'
  panel.style.cssText = `
    display: none;
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.85);
    color: #fff;
    font: 12px monospace;
    padding: 12px;
    border-radius: 6px;
    z-index: 1000;
    max-height: 90vh;
    overflow-y: auto;
    min-width: 200px;
  `

  const title = document.createElement('div')
  title.textContent = 'DEBUG PANEL [F2]'
  title.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ff8844;'
  panel.appendChild(title)

  // ── Sections ──
  addSection(panel, 'PLAYER')
  addButton(panel, 'God Mode (full HP)', () => {
    state.player.hp = PLAYER_MAX_HP
  })
  addButton(panel, 'Infinite Bullet Time', () => {
    state.player.bulletTimeEnergy = BULLET_TIME_MAX
  })
  addButton(panel, 'Max Ammo', () => {
    state.playerAmmo.pistol = -1
    state.playerAmmo.shotgun = 999
    state.playerAmmo.m16 = 999
    state.playerAmmo.sniper = 999
    state.playerAmmo.grenades = 999
    for (const w of ['pistol', 'shotgun', 'm16', 'sniper', 'grenades'] as const) {
      state.magRounds[w] = WEAPONS[w].magSize
    }
  })

  addSection(panel, 'SPAWN ENEMIES')
  const enemyTypes: EnemyBehavior[] = ['grunt', 'shotgunner', 'sniper', 'rusher', 'boss', 'drone']
  for (const type of enemyTypes) {
    addButton(panel, `+ ${type}`, () => {
      const x = state.player.x + (state.player.facing > 0 ? 200 : -200)
      const y = type === 'drone' ? state.player.y - 80 : state.player.y
      spawnEnemy(x, y, type)
    })
  }
  addButton(panel, 'Kill All Enemies', () => {
    for (const e of state.enemies) {
      if (e.state !== 'dead') {
        e.state = 'dead'
        e.deathTimer = 0.1
        e.vx = 0
        e.vy = 0
      }
    }
  })

  addSection(panel, 'LEVELS')
  for (let i = 0; i < LEVELS.length; i++) {
    addButton(panel, `Level ${i + 1}`, () => {
      setLevel(i)
      state.coverBoxes.length = 0
      spawnCoverBoxes()
    })
  }

  addSection(panel, 'WAVES')
  addButton(panel, 'Skip to Wave 5', () => { state.wave = 4; state.waveState = 'countdown'; state.waveTimer = 1 })
  addButton(panel, 'Skip to Wave 10', () => { state.wave = 9; state.waveState = 'countdown'; state.waveTimer = 1 })
  addButton(panel, 'Clear Wave', () => {
    for (const e of state.enemies) {
      if (e.state !== 'dead') {
        e.state = 'dead'
        e.deathTimer = 0.1
        e.vx = 0
        e.vy = 0
        state.killCount++
      }
    }
  })

  addSection(panel, 'SOUNDS')
  addButton(panel, 'Pistol', () => SFX.pistolShot())
  addButton(panel, 'Shotgun', () => SFX.shotgunShot())
  addButton(panel, 'M16', () => SFX.m16Shot())
  addButton(panel, 'Sniper', () => SFX.sniperShot())
  addButton(panel, 'Hit', () => SFX.bulletImpact())
  addButton(panel, 'Headshot', () => SFX.headshot())
  addButton(panel, 'Reload', () => SFX.reload())
  addButton(panel, 'Empty Click', () => SFX.emptyClick())
  addButton(panel, 'Explosion', () => SFX.explosion())
  addButton(panel, 'Pickup', () => SFX.pickup())
  addButton(panel, 'Shell Casing', () => SFX.shellCasing())
  addButton(panel, 'Bullet Time On', () => SFX.bulletTimeOn())
  addButton(panel, 'Thunder', () => SFX.thunder())
  addButton(panel, 'Enemy Death (grunt)', () => SFX.enemyDeath('grunt'))
  addButton(panel, 'Enemy Death (thug)', () => SFX.enemyDeath('thug'))
  addButton(panel, 'Wave Cleared', () => SFX.waveCleared())

  addSection(panel, 'MISC')
  addButton(panel, 'Reset Position', () => {
    state.player.x = 100
    state.player.y = 500
    state.player.vx = 0
    state.player.vy = 0
  })
  addButton(panel, 'Toggle Invincible', () => {
    state.player.hp = 99999
  })

  document.body.appendChild(panel)
}

function addSection(parent: HTMLElement, label: string) {
  const div = document.createElement('div')
  div.textContent = label
  div.style.cssText = 'color: #aaa; font-size: 10px; margin-top: 10px; margin-bottom: 4px; border-bottom: 1px solid #333; padding-bottom: 2px;'
  parent.appendChild(div)
}

function addButton(parent: HTMLElement, label: string, onClick: () => void) {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = `
    display: block;
    width: 100%;
    padding: 4px 8px;
    margin: 2px 0;
    background: #333;
    color: #ddd;
    border: 1px solid #555;
    border-radius: 3px;
    font: 11px monospace;
    cursor: pointer;
    text-align: left;
  `
  btn.addEventListener('mouseenter', () => { btn.style.background = '#555' })
  btn.addEventListener('mouseleave', () => { btn.style.background = '#333' })
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  parent.appendChild(btn)
}
