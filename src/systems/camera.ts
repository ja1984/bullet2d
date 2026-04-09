// ─── Camera ──────────────────────────────────────────────────────────────────

import { CANVAS_W, CANVAS_H } from '../constants'
import { state } from '../state'

export function updateCamera(dt: number) {
  const { player, camera } = state

  // Camera Zoom
  const targetZoom = (player.bulletTimeActive || state.killCamActive) ? 1.12 : (state.deathSlowMo ? 1.15 : 1)
  state.baseCameraZoom += (targetZoom - state.baseCameraZoom) * 3 * dt

  // Camera follow
  const targetCamX = player.x + player.w / 2 - CANVAS_W / 2
  const targetCamY = player.y + player.h / 2 - CANVAS_H / 2 - 50
  camera.x += (targetCamX - camera.x) * 4 * dt
  camera.y += (targetCamY - camera.y) * 4 * dt

  // Account for zoom — when zoomed in, the visible area is smaller
  // so camera bounds need to be tighter to avoid showing out-of-bounds
  const zoom = state.baseCameraZoom
  const zoomOffsetX = (CANVAS_W - CANVAS_W / zoom) / 2
  const zoomOffsetY = (CANVAS_H - CANVAS_H / zoom) / 2
  camera.x = Math.max(0 - zoomOffsetX, Math.min(camera.x, 2400 - CANVAS_W + zoomOffsetX))
  camera.y = Math.max(-200 - zoomOffsetY, Math.min(camera.y, 720 - CANVAS_H + zoomOffsetY))
}
