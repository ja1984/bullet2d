// ─── Shared Physics (used by both server and client) ────────────────────────

import type { Rect, CoverBox } from './types'
import { GRAVITY } from './constants'

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function resolvePhysicsShared(
  entity: { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean },
  dt: number,
  platforms: Rect[],
  coverBoxes: CoverBox[],
) {
  entity.vy += GRAVITY * dt
  entity.x += entity.vx * dt
  entity.y += entity.vy * dt
  entity.onGround = false

  const allSolids = [...platforms, ...coverBoxes]
  for (const p of allSolids) {
    if (!rectsOverlap(entity, p)) continue

    const overlapLeft = (entity.x + entity.w) - p.x
    const overlapRight = (p.x + p.w) - entity.x
    const overlapTop = (entity.y + entity.h) - p.y
    const overlapBottom = (p.y + p.h) - entity.y

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

    if (minOverlap === overlapTop && entity.vy >= 0) {
      entity.y = p.y - entity.h
      entity.vy = 0
      entity.onGround = true
    } else if (minOverlap === overlapBottom && entity.vy < 0) {
      entity.y = p.y + p.h
      entity.vy = 0
    } else if (minOverlap === overlapLeft) {
      entity.x = p.x - entity.w
      entity.vx = 0
    } else if (minOverlap === overlapRight) {
      entity.x = p.x + p.w
      entity.vx = 0
    }
  }
}
