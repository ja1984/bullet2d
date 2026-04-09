// ─── Wave System ─────────────────────────────────────────────────────────────

import type { CoverBox, EnemyBehavior } from '../types'
import { ENEMY_CONFIGS, LEVELS, platforms, spawnPositions, setLevel, setGeneratedLevel } from '../constants'
import { state } from '../state'
import { generateLevel, populateLevel } from './levelgen'

// Difficulty multiplier — enemies get tougher each wave
export function getDifficultyMult(): number {
  return 1 + (state.wave - 1) * 0.1 // +10% per wave
}

export function spawnEnemy(x: number, y: number, behavior: EnemyBehavior) {
  const cfg = ENEMY_CONFIGS[behavior]
  const diff = getDifficultyMult()
  const scaledHp = Math.round(cfg.hp * diff)
  state.enemies.push({
    x, y,
    w: behavior === 'boss' ? 36 : behavior === 'drone' ? 16 : 24,
    h: behavior === 'boss' ? 56 : behavior === 'drone' ? 16 : 44,
    hp: scaledHp, maxHp: scaledHp,
    vx: 0, vy: 0,
    onGround: false,
    facing: -1,
    shootTimer: Math.random() * cfg.shootInterval,
    alertTimer: 0,
    state: 'idle',
    deathTimer: 0,
    patrolDir: Math.random() > 0.5 ? 1 : -1,
    patrolTimer: Math.random() * 3 + 1,
    type: behavior === 'grunt' ? 'thug' : 'grunt', // grunt behavior uses thug sprites (pistol enemy)
    behavior,
    animTimer: 0,
    currentAnim: 'idle',
    hitTimer: 0,
    showHpTimer: 0,
  })
}

export function getWaveEnemies(waveNum: number): { behavior: EnemyBehavior; count: number }[] {
  // Boss wave every 5
  if (waveNum % 5 === 0) {
    return [
      { behavior: 'boss', count: 1 },
      { behavior: 'grunt', count: Math.floor(waveNum / 2) },
    ]
  }
  if (waveNum <= 1) return [{ behavior: 'grunt', count: 4 }]
  if (waveNum === 2) return [{ behavior: 'grunt', count: 5 }, { behavior: 'shotgunner', count: 1 }]
  if (waveNum === 3) return [{ behavior: 'grunt', count: 4 }, { behavior: 'shotgunner', count: 2 }, { behavior: 'sniper', count: 1 }]
  if (waveNum === 4) return [{ behavior: 'grunt', count: 3 }, { behavior: 'rusher', count: 3 }, { behavior: 'drone', count: 2 }]
  // Wave 6+ scales up
  const base = waveNum - 3
  return [
    { behavior: 'grunt', count: 2 + base },
    { behavior: 'shotgunner', count: 1 + Math.floor(base / 2) },
    { behavior: 'sniper', count: 1 + Math.floor(base / 3) },
    { behavior: 'rusher', count: 1 + Math.floor(base / 2) },
    { behavior: 'drone', count: Math.floor(base / 2) },
  ]
}

export function startWave() {
  state.wave++
  // Generate a fresh level each wave
  const level = generateLevel(state.wave)
  setGeneratedLevel(level.platforms, level.spawnPositions)
  populateLevel(level.platforms, state.wave)
  state.waveState = 'active'
  state.invincibleTimer = 1.0
  state.reinforcementsSent = false
  const waveEnemies = getWaveEnemies(state.wave)
  let spawnIdx = 0
  for (const group of waveEnemies) {
    for (let i = 0; i < group.count; i++) {
      const pos = spawnPositions[spawnIdx % spawnPositions.length]
      spawnEnemy(pos.x, pos.y, group.behavior)
      spawnIdx++
    }
  }
  state.waveEnemiesAlive = state.enemies.filter(e => e.state !== 'dead').length
}

export function spawnEnemies() {
  // Legacy compat — just start wave 1
  startWave()
}

export function spawnCoverBoxes() {
  state.coverBoxes.length = 0
  const boxTypes: CoverBox['type'][] = ['crate', 'barrel', 'sandbag']
  // Spawn on ground and on platforms
  const groundY = 620
  const groundSpots = [300, 550, 800, 1050, 1300, 1600, 1850, 2050]
  for (const gx of groundSpots) {
    if (Math.random() < 0.6) {
      const t = boxTypes[Math.floor(Math.random() * boxTypes.length)]
      const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
      const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
      state.coverBoxes.push({
        x: gx + (Math.random() - 0.5) * 60,
        y: groundY - h,
        w, h,
        hp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        maxHp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        type: t,
      })
    }
  }
  // A few on platforms — derive spots from the actual level platforms
  const plats = platforms.filter(p => p.h <= 20 && p.w >= 150) // skip ground, walls, tiny platforms
  for (const plat of plats) {
    if (Math.random() < 0.4) {
      const t = boxTypes[Math.floor(Math.random() * boxTypes.length)]
      const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
      const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
      const x = plat.x + 20 + Math.random() * (plat.w - w - 40)
      state.coverBoxes.push({
        x, y: plat.y - h, w, h,
        hp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        maxHp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60,
        type: t,
      })
    }
  }
  // Explosive barrels — a few scattered on ground
  const explosiveSpots = [450, 900, 1250, 1700]
  for (const ex of explosiveSpots) {
    if (Math.random() < 0.4) {
      state.coverBoxes.push({
        x: ex + (Math.random() - 0.5) * 40,
        y: groundY - 28,
        w: 20, h: 28,
        hp: 20, maxHp: 20,
        type: 'explosive',
      })
    }
  }
}
