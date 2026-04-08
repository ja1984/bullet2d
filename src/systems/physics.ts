// ─── Physics ─────────────────────────────────────────────────────────────────

import type { Rect } from '../types'
import { GRAVITY, platforms } from '../constants'
import { state } from '../state'

// Returns -1 if touching wall on left, 1 if right, 0 if no wall
export function checkWallContact(entity: { x: number; y: number; w: number; h: number }): number {
  const allSolids = [...platforms, ...state.coverBoxes]
  const margin = 2
  for (const s of allSolids) {
    // Check right side of entity against left side of solid
    if (entity.x + entity.w >= s.x - margin && entity.x + entity.w <= s.x + margin &&
        entity.y + entity.h > s.y && entity.y < s.y + s.h) {
      return 1 // wall on right
    }
    // Check left side of entity against right side of solid
    if (entity.x <= s.x + s.w + margin && entity.x >= s.x + s.w - margin &&
        entity.y + entity.h > s.y && entity.y < s.y + s.h) {
      return -1 // wall on left
    }
  }
  return 0
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function resolvePhysics(
  entity: { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean },
  dt: number
) {
  entity.vy += GRAVITY * dt
  entity.x += entity.vx * dt
  entity.y += entity.vy * dt
  entity.onGround = false

  for (const p of platforms) {
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

  // Cover box collision
  for (const box of state.coverBoxes) {
    if (!rectsOverlap(entity, box)) continue

    const overlapLeft = (entity.x + entity.w) - box.x
    const overlapRight = (box.x + box.w) - entity.x
    const overlapTop = (entity.y + entity.h) - box.y
    const overlapBottom = (box.y + box.h) - entity.y

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

    if (minOverlap === overlapTop && entity.vy >= 0) {
      entity.y = box.y - entity.h
      entity.vy = 0
      entity.onGround = true
    } else if (minOverlap === overlapBottom && entity.vy < 0) {
      entity.y = box.y + box.h
      entity.vy = 0
    } else if (minOverlap === overlapLeft) {
      entity.x = box.x - entity.w
      entity.vx = 0
    } else if (minOverlap === overlapRight) {
      entity.x = box.x + box.w
      entity.vx = 0
    }
  }
}
