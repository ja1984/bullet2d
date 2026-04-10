// ─── Shared Level Generator (pure functions, no DOM/state deps) ─────────────

import type { CoverBox, Rect, Vec2, WeaponType } from './types'

const LEVEL_W = 2400
const GROUND_Y = 620
const WALL_W = 20

function generatePlatforms(wave: number, playerCount = 1): Rect[] {
  const plats: Rect[] = []
  const hasGaps = wave >= 3 && Math.random() < 0.5
  if (hasGaps) {
    const gapCount = 1 + Math.floor(Math.random() * 2)
    const segments: { start: number; end: number }[] = []
    let x = 0
    for (let i = 0; i <= gapCount; i++) {
      const segEnd = i === gapCount ? LEVEL_W : (LEVEL_W / (gapCount + 1)) * (i + 1) - 80 - Math.random() * 60
      segments.push({ start: x, end: segEnd })
      x = segEnd + 160 + Math.random() * 80
    }
    for (const seg of segments) {
      if (seg.end > seg.start + 50) {
        plats.push({ x: seg.start, y: GROUND_Y, w: seg.end - seg.start, h: 100 })
      }
    }
    for (let i = 0; i < segments.length - 1; i++) {
      const gapStart = segments[i].end
      const gapEnd = segments[i + 1].start
      if (gapEnd - gapStart > 50) {
        plats.push({ x: gapStart - 20, y: GROUND_Y - 30, w: gapEnd - gapStart + 40, h: 20, destructible: true, hp: 50, maxHp: 50 })
      }
    }
  } else {
    plats.push({ x: 0, y: GROUND_Y, w: LEVEL_W, h: 100 })
  }
  plats.push({ x: 0, y: 0, w: WALL_W, h: 720 })
  plats.push({ x: LEVEL_W - WALL_W, y: 0, w: WALL_W, h: 720 })
  const extraTiers = playerCount >= 3 ? 1 : 0
  const tiers = 2 + Math.min(Math.floor(wave / 2), 2) + extraTiers
  const tierHeights = [480, 340, 210, 120, 60]
  const usedRects: Rect[] = []
  for (let t = 0; t < tiers && t < tierHeights.length; t++) {
    const tierY = tierHeights[t] + (Math.random() - 0.5) * 30
    const extraPlats = Math.floor((playerCount - 1) * 0.5)
    const platCount = 2 + Math.floor(Math.random() * 2) + extraPlats
    const minGap = 160
    let cursor = 80 + Math.random() * 200
    for (let p = 0; p < platCount && cursor < LEVEL_W - 250; p++) {
      const w = 150 + Math.floor(Math.random() * 200)
      const y = tierY + (Math.random() - 0.5) * 20
      const candidate: Rect = { x: cursor, y, w, h: 20 }
      let overlaps = false
      for (const existing of usedRects) {
        if (candidate.x < existing.x + existing.w + 60 && candidate.x + candidate.w + 60 > existing.x && Math.abs(candidate.y - existing.y) < 80) {
          overlaps = true; break
        }
      }
      if (!overlaps) {
        if (wave >= 2 && Math.random() < 0.2) {
          candidate.destructible = true
          candidate.hp = 40 + Math.floor(Math.random() * 20)
          candidate.maxHp = candidate.hp
        }
        plats.push(candidate)
        usedRects.push(candidate)
      }
      cursor += w + minGap + Math.random() * 250
    }
  }
  return plats
}

function generateSpawnPositions(plats: Rect[]): Vec2[] {
  const groundSpawns: Vec2[] = []
  const elevatedSpawns: Vec2[] = []
  for (const p of plats.filter(p => p.y === GROUND_Y)) {
    const count = Math.max(1, Math.floor(p.w / 300))
    for (let i = 0; i < count; i++) {
      const x = p.x + 40 + (p.w - 80) * (i / Math.max(1, count - 1)) + (Math.random() - 0.5) * 20
      groundSpawns.push({ x, y: GROUND_Y - 50 })
    }
  }
  for (const p of plats.filter(p => p.h <= 20 && p.y < GROUND_Y)) {
    elevatedSpawns.push({ x: p.x + p.w / 2 + (Math.random() - 0.5) * (p.w * 0.4), y: p.y - 50 })
  }
  const spawns: Vec2[] = []
  groundSpawns.sort(() => Math.random() - 0.5)
  elevatedSpawns.sort(() => Math.random() - 0.5)
  let gi = 0, ei = 0
  while (gi < groundSpawns.length || ei < elevatedSpawns.length) {
    if (ei < elevatedSpawns.length) spawns.push(elevatedSpawns[ei++])
    if (gi < groundSpawns.length) spawns.push(groundSpawns[gi++])
  }
  return spawns
}

export function generateCoverBoxes(plats: Rect[]): CoverBox[] {
  const boxes: CoverBox[] = []
  const boxTypes: CoverBox['type'][] = ['crate', 'barrel', 'sandbag', 'explosive']
  for (const gp of plats.filter(p => p.y === GROUND_Y)) {
    const spotCount = Math.floor(gp.w / 250)
    for (let i = 0; i < spotCount; i++) {
      if (Math.random() < 0.5) {
        const t = boxTypes[Math.floor(Math.random() * (Math.random() < 0.25 ? 4 : 3))]
        const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
        const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
        const bx = gp.x + 40 + (i * 250) + Math.random() * 150
        if (bx + w < gp.x + gp.w - 20) {
          boxes.push({ x: bx, y: gp.y - h, w, h, hp: t === 'explosive' ? 20 : t === 'crate' ? 40 : t === 'barrel' ? 25 : 60, maxHp: t === 'explosive' ? 20 : t === 'crate' ? 40 : t === 'barrel' ? 25 : 60, type: t })
        }
      }
    }
  }
  for (const ep of plats.filter(p => p.h <= 20 && p.w >= 150 && p.y < GROUND_Y)) {
    if (Math.random() < 0.35) {
      const t = boxTypes[Math.floor(Math.random() * 3)]
      const w = t === 'sandbag' ? 40 : t === 'crate' ? 30 : 20
      const h = t === 'sandbag' ? 20 : t === 'crate' ? 30 : 28
      boxes.push({ x: ep.x + 15 + Math.random() * (ep.w - w - 30), y: ep.y - h, w, h, hp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60, maxHp: t === 'crate' ? 40 : t === 'barrel' ? 25 : 60, type: t })
    }
  }
  return boxes
}

export function generateWeaponPickups(plats: Rect[]): { pos: Vec2; type: WeaponType }[] {
  const pickups: { pos: Vec2; type: WeaponType }[] = []
  const types: WeaponType[] = ['shotgun', 'm16', 'sniper']
  const elevPlats = plats.filter(p => p.h <= 20 && p.w >= 120 && p.y < GROUND_Y && !p.destructible)
  const shuffled = [...elevPlats].sort(() => Math.random() - 0.5)
  const count = Math.min(4 + Math.floor(Math.random() * 3), shuffled.length)
  for (let i = 0; i < count; i++) {
    const p = shuffled[i]
    pickups.push({ pos: { x: p.x + p.w / 2 - 10, y: p.y - 20 }, type: types[Math.floor(Math.random() * types.length)] })
  }
  const groundPlats = plats.filter(p => p.y === GROUND_Y)
  if (groundPlats.length > 0) {
    const gp = groundPlats[Math.floor(Math.random() * groundPlats.length)]
    pickups.push({ pos: { x: gp.x + 100 + Math.random() * (gp.w - 200), y: GROUND_Y - 20 }, type: types[Math.floor(Math.random() * types.length)] })
  }
  return pickups
}

export function generateLevel(wave: number, playerCount = 1): { platforms: Rect[]; spawnPositions: Vec2[] } {
  const plats = generatePlatforms(wave, playerCount)
  return { platforms: plats, spawnPositions: generateSpawnPositions(plats) }
}
