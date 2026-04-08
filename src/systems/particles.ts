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
  // Muzzle flash particles
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

  // Muzzle flash sprite — bright directional flash
  const flashDist = 8
  state.particles.push({
    x: x + Math.cos(angle) * flashDist,
    y: y + Math.sin(angle) * flashDist,
    vx: Math.cos(angle) * 20,
    vy: Math.sin(angle) * 20,
    life: 0.05,
    maxLife: 0.05,
    color: '#fff',
    size: 8 + Math.random() * 4,
  })

  // Dynamic light flash
  state.lightFlashes.push({ x, y, intensity: 1.0, color: 'rgba(255,200,100,' })
}

export function spawnExplosionLight(x: number, y: number) {
  state.lightFlashes.push({ x, y, intensity: 1.5, color: 'rgba(255,120,40,' })
}
