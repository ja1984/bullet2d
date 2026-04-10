// ─── Shared Wave Logic (pure functions, no state deps) ──────────────────────

import type { EnemyBehavior, ServerEnemy, Rect, Vec2 } from './types'
import { ENEMY_CONFIGS } from './constants'

export function getDifficultyMult(wave: number): number {
  return 1 + (wave - 1) * 0.1
}

export function getWaveEnemies(waveNum: number): { behavior: EnemyBehavior; count: number }[] {
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
  const base = waveNum - 3
  return [
    { behavior: 'grunt', count: 2 + base },
    { behavior: 'shotgunner', count: 1 + Math.floor(base / 2) },
    { behavior: 'sniper', count: 1 + Math.floor(base / 3) },
    { behavior: 'rusher', count: 1 + Math.floor(base / 2) },
    { behavior: 'drone', count: Math.floor(base / 2) },
  ]
}

export function createEnemy(x: number, y: number, behavior: EnemyBehavior, wave: number): ServerEnemy {
  const cfg = ENEMY_CONFIGS[behavior]
  const diff = getDifficultyMult(wave)
  const scaledHp = Math.round(cfg.hp * diff)
  return {
    x, y,
    w: behavior === 'boss' ? 36 : behavior === 'drone' ? 16 : 24,
    h: behavior === 'boss' ? 56 : behavior === 'drone' ? 16 : 44,
    vx: 0, vy: 0, hp: scaledHp, maxHp: scaledHp,
    onGround: false, facing: -1,
    state: 'idle', behavior,
    type: behavior === 'grunt' ? 'thug' : 'grunt',
    shootTimer: Math.random() * cfg.shootInterval,
    alertTimer: 0, deathTimer: 0, hitTimer: 0,
    patrolDir: Math.random() > 0.5 ? 1 : -1,
    patrolTimer: Math.random() * 3 + 1,
  }
}

export function spawnWaveEnemies(wave: number, spawnPositions: Vec2[]): ServerEnemy[] {
  const enemies: ServerEnemy[] = []
  const waveEnemies = getWaveEnemies(wave)
  let spawnIdx = 0
  for (const group of waveEnemies) {
    for (let i = 0; i < group.count; i++) {
      const pos = spawnPositions[spawnIdx % spawnPositions.length]
      enemies.push(createEnemy(pos.x, pos.y, group.behavior, wave))
      spawnIdx++
    }
  }
  return enemies
}
