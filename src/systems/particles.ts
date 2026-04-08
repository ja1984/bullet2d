// ─── Particles ───────────────────────────────────────────────────────────────

import { state } from '../state'

export function spawnParticles(x: number, y: number, count: number, color: string, speed = 200) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const spd = Math.random() * speed
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 50,
      life: 0.3 + Math.random() * 0.5,
      maxLife: 0.3 + Math.random() * 0.5,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

export function spawnMuzzleFlash(x: number, y: number, angle: number) {
  for (let i = 0; i < 5; i++) {
    const spread = (Math.random() - 0.5) * 0.5
    const spd = 100 + Math.random() * 150
    state.particles.push({
      x, y,
      vx: Math.cos(angle + spread) * spd,
      vy: Math.sin(angle + spread) * spd,
      life: 0.1 + Math.random() * 0.1,
      maxLife: 0.15,
      color: '#ffa',
      size: 3 + Math.random() * 3,
    })
  }
}
