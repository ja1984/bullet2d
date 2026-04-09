// ─── Draw Level ──────────────────────────────────────────────────────────────

import { CANVAS_W, platforms } from '../constants'
import { state } from '../state'

export function drawPlatforms() {
  const ctx = state.ctx!

  for (const p of platforms) {
    if (p.destructible) {
      // Destructible platform — wood/cracked look
      const dmg = (p.hp ?? 0) / (p.maxHp ?? 1)
      ctx.fillStyle = dmg > 0.5 ? '#5a4a2e' : '#4a3a1e'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = '#6a5a3e'
      ctx.fillRect(p.x, p.y, p.w, 2)
      // Cracks when damaged
      if (dmg < 0.6) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.fillRect(p.x + p.w * 0.3, p.y + 2, 2, p.h - 2)
        ctx.fillRect(p.x + p.w * 0.7, p.y + 2, 2, p.h - 2)
      }
    } else {
      ctx.fillStyle = '#2a2a3e'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = '#4a4a6e'
      ctx.fillRect(p.x, p.y, p.w, 2)
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(p.x, p.y, 2, p.h)
      ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h)
    }
  }
}

export function drawBloodDecals() {
  const ctx = state.ctx!

  for (const bd of state.bloodDecals) {
    ctx.globalAlpha = bd.alpha * 0.6
    const s = bd.size
    // Main pool — dark ellipse flush with ground
    ctx.fillStyle = '#2a0808'
    ctx.beginPath()
    ctx.ellipse(bd.x, bd.y + 1, s * 0.7, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    // Inner highlight — slightly lighter core
    ctx.fillStyle = '#3a0a0a'
    ctx.beginPath()
    ctx.ellipse(bd.x, bd.y + 1, s * 0.4, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Small satellite splats using deterministic offsets
    ctx.fillStyle = '#2a0808'
    for (let j = 0; j < 3; j++) {
      const ox = Math.sin(bd.x * 0.1 + j * 2.3) * s * 0.6
      const oy = Math.cos(bd.x * 0.2 + j * 1.7) * 1.5
      ctx.beginPath()
      ctx.ellipse(bd.x + ox, bd.y + oy + 1, 3, 1.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
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
    } else if (box.type === 'explosive') {
      // Explosive barrel — red with hazard markings
      ctx.fillStyle = '#882222'
      ctx.fillRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = '#aa3333'
      ctx.fillRect(box.x + 2, box.y + 3, box.w - 4, box.h - 6)
      // Metal bands
      ctx.fillStyle = '#555555'
      ctx.fillRect(box.x, box.y + 4, box.w, 2)
      ctx.fillRect(box.x, box.y + box.h - 6, box.w, 2)
      // Hazard symbol — small yellow warning
      ctx.fillStyle = '#ffcc00'
      ctx.fillRect(box.x + box.w / 2 - 3, box.y + box.h / 2 - 3, 6, 6)
      ctx.fillStyle = '#882222'
      ctx.fillRect(box.x + box.w / 2 - 1, box.y + box.h / 2 - 1, 2, 2)
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

export function drawSteamVents() {
  const ctx = state.ctx!

  for (const sv of state.steamVents) {
    const gx = sv.x - 8
    const gy = sv.y - 4
    // Grate base
    ctx.fillStyle = '#222233'
    ctx.fillRect(gx, gy, 16, 4)
    // Grate slats
    ctx.fillStyle = '#111118'
    for (let sx = gx + 2; sx < gx + 15; sx += 4) {
      ctx.fillRect(sx, gy + 1, 2, 2)
    }
    // Rim highlight
    ctx.fillStyle = '#333344'
    ctx.fillRect(gx, gy, 16, 1)
    // Warm glow when active
    if (sv.active) {
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#aabbcc'
      ctx.fillRect(gx - 2, gy - 2, 20, 6)
      ctx.globalAlpha = 1
    }
  }
}

export function drawPuddles() {
  const ctx = state.ctx!

  for (const pd of state.puddles) {
    // Base puddle — dark reflective ellipse
    ctx.globalAlpha = 0.15
    ctx.fillStyle = '#4466aa'
    ctx.beginPath()
    ctx.ellipse(pd.x + pd.w / 2, pd.y + 1, pd.w / 2, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Highlight from nearby light flashes
    for (const lf of state.lightFlashes) {
      const dx = lf.x - pd.x - pd.w / 2
      const dy = lf.y - pd.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 150) {
        const brightness = (1 - dist / 150) * lf.intensity * 0.2
        ctx.globalAlpha = brightness
        ctx.fillStyle = lf.color + '0.6)'
        ctx.beginPath()
        ctx.ellipse(pd.x + pd.w / 2, pd.y + 1, pd.w / 3, 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Highlight from nearby streetlights
    for (const sl of state.streetlights) {
      if (!sl.on) continue
      const dx = sl.x - pd.x - pd.w / 2
      if (Math.abs(dx) < 80) {
        ctx.globalAlpha = 0.06
        ctx.fillStyle = '#ffcc66'
        ctx.beginPath()
        ctx.ellipse(pd.x + pd.w / 2, pd.y + 1, pd.w / 3, 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
}

export function drawStreetlights() {
  const ctx = state.ctx!

  for (const sl of state.streetlights) {
    // Pole
    ctx.fillStyle = '#333344'
    ctx.fillRect(sl.x - 2, sl.y - 70, 4, 70)
    // Arm
    ctx.fillRect(sl.x - 1, sl.y - 70, 12, 3)
    // Lamp housing
    ctx.fillStyle = '#444455'
    ctx.fillRect(sl.x + 6, sl.y - 70, 8, 5)

    if (sl.on) {
      // Lamp glow
      ctx.fillStyle = '#ffcc66'
      ctx.fillRect(sl.x + 7, sl.y - 67, 6, 2)

      // Light cone on ground
      ctx.globalAlpha = 0.06
      const grad = ctx.createRadialGradient(sl.x + 10, sl.y, 0, sl.x + 10, sl.y, 70)
      grad.addColorStop(0, '#ffcc66')
      grad.addColorStop(1, 'rgba(255,204,102,0)')
      ctx.fillStyle = grad
      ctx.fillRect(sl.x - 60, sl.y - 70, 140, 80)
      ctx.globalAlpha = 1
    }
  }
}

export function drawPigeons() {
  const ctx = state.ctx!

  for (const p of state.pigeons) {
    if (p.scattered) {
      ctx.globalAlpha = Math.min(1, p.life)
    }

    // Body
    ctx.fillStyle = '#667777'
    ctx.fillRect(p.x - 3, p.y - 3, 6, 4)
    // Head
    ctx.fillStyle = '#556666'
    const headX = p.scattered ? p.x + (p.vx > 0 ? 3 : -3) : p.x + 3
    ctx.fillRect(headX, p.y - 5, 3, 3)
    // Beak
    ctx.fillStyle = '#aa8855'
    const pecking = !p.scattered && p.peckTimer < 0.15
    ctx.fillRect(headX + 2, p.y - (pecking ? 3 : 4), 2, 1)

    // Wings when scattered (flapping)
    if (p.scattered) {
      const wingUp = Math.sin(state.gameTime * 25 + p.x) > 0
      ctx.fillStyle = '#778888'
      if (wingUp) {
        ctx.fillRect(p.x - 4, p.y - 7, 3, 2)
        ctx.fillRect(p.x + 1, p.y - 7, 3, 2)
      } else {
        ctx.fillRect(p.x - 4, p.y - 1, 3, 2)
        ctx.fillRect(p.x + 1, p.y - 1, 3, 2)
      }
    }

    ctx.globalAlpha = 1
  }
}
