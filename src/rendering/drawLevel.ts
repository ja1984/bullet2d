// ─── Draw Level ──────────────────────────────────────────────────────────────

import { platforms } from '../constants'
import { state } from '../state'

export function drawPlatforms() {
  const ctx = state.ctx!

  for (const p of platforms) {
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(p.x, p.y, p.w, p.h)
    ctx.fillStyle = '#4a4a6e'
    ctx.fillRect(p.x, p.y, p.w, 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(p.x, p.y, 2, p.h)
    ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h)
  }
}

export function drawBloodDecals() {
  const ctx = state.ctx!

  for (const bd of state.bloodDecals) {
    ctx.globalAlpha = bd.alpha
    ctx.fillStyle = '#551111'
    // Pixelated blood — random squares
    const s = bd.size
    for (let px = -s; px < s; px += 4) {
      for (let py = -2; py <= 2; py += 4) {
        if (Math.abs(px) + Math.abs(py) * 3 < s) {
          ctx.fillRect(bd.x + px, bd.y + py, 4, 3)
        }
      }
    }
    ctx.fillStyle = '#440000'
    ctx.fillRect(bd.x - s * 0.3, bd.y - 1, s * 0.6, 2)
  }
  ctx.globalAlpha = 1
}

export function drawCoverBoxes() {
  const ctx = state.ctx!

  for (const box of state.coverBoxes) {
    const dmgRatio = box.hp / box.maxHp

    if (box.type === 'crate') {
      ctx.fillStyle = '#8B6914'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#A07818'
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4)
      // Cross planks
      ctx.fillStyle = '#8B6914'
      ctx.fillRect(box.x + box.w / 2 - 1, box.y, 2, box.h)
      ctx.fillRect(box.x, box.y + box.h / 2 - 1, box.w, 2)
    } else if (box.type === 'barrel') {
      ctx.fillStyle = '#664433'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#775544'
      ctx.fillRect(box.x + 2, box.y + 3, box.w - 4, box.h - 6)
      // Metal bands
      ctx.fillStyle = '#555555'
      ctx.fillRect(box.x, box.y + 4, box.w, 2)
      ctx.fillRect(box.x, box.y + box.h - 6, box.w, 2)
    } else {
      // Sandbag
      ctx.fillStyle = '#8B8B6B'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#9B9B7B'
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4)
      // Bag lines
      ctx.fillStyle = '#7B7B5B'
      for (let sx = box.x + 8; sx < box.x + box.w; sx += 12) {
        ctx.fillRect(sx, box.y, 1, box.h)
      }
    }

    // Damage cracks
    if (dmgRatio < 0.6) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(box.x + box.w * 0.3, box.y + 2, 2, box.h * 0.4)
      ctx.fillRect(box.x + box.w * 0.6, box.y + box.h * 0.3, 2, box.h * 0.5)
    }
    if (dmgRatio < 0.3) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(box.x + 3, box.y + box.h * 0.5, box.w * 0.4, 2)
    }

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(box.x, box.y, box.w, 1)
  }
}
