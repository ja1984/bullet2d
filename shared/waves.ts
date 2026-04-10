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

export function getPlayerScaling(playerCount: number): { countMult: number; hpMult: number } {
  // 1 player = 1x enemies, 1x hp
  // 2 players = 1.5x enemies, 1.1x hp
  // 5 players = 3x enemies, 1.3x hp
  // 20 players = 10.5x enemies, 2x hp
  return {
    countMult: 0.5 + playerCount * 0.5,
    hpMult: 1 + (playerCount - 1) * 0.1,
  }
}

export function spawnWaveEnemies(wave: number, spawnPositions: Vec2[], playerCount = 1): ServerEnemy[] {
  const enemies: ServerEnemy[] = []
  const waveEnemies = getWaveEnemies(wave)
  const { countMult, hpMult } = getPlayerScaling(playerCount)
  let spawnIdx = 0
  for (const group of waveEnemies) {
    const scaledCount = Math.max(1, Math.round(group.count * countMult))
    for (let i = 0; i < scaledCount; i++) {
      const pos = spawnPositions[spawnIdx % spawnPositions.length]
      const enemy = createEnemy(pos.x, pos.y, group.behavior, wave)
      // Scale HP for player count
      enemy.hp = Math.round(enemy.hp * hpMult)
      enemy.maxHp = enemy.hp
      enemies.push(enemy)
      spawnIdx++
    }
  }
  return enemies
}
