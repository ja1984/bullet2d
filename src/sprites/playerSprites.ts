// ─── Player Sprite System ────────────────────────────────────────────────────

import type { PlayerAnim, SpriteAnim } from '../types'
import { SPRITE_FRAME_SIZE, DIVE_SPRITE_Y_OFFSET, spriteConfig } from '../constants'
import { state } from '../state'

export const playerSprites: Record<PlayerAnim, SpriteAnim> = {} as any

export let spritesEnabled = false

export function loadPlayerSprites() {
  let totalFrames = 0
  let loadedFrames = 0

  for (const config of Object.values(spriteConfig)) {
    totalFrames += config.frames
  }

  for (const [anim, config] of Object.entries(spriteConfig)) {
    const animData: SpriteAnim = {
      frames: [],
      fps: config.fps,
      loaded: false,
    }

    let animLoaded = 0
    for (let i = 0; i < config.frames; i++) {
      const img = new Image()
      img.onload = () => {
        animLoaded++
        loadedFrames++
        if (animLoaded === config.frames) {
          animData.loaded = true
        }
        if (loadedFrames === totalFrames) {
          spritesEnabled = true
          console.log('All player sprites loaded!')
        }
      }
      img.onerror = () => {
        console.warn(`Sprite not found: sprites/player/${anim}/${anim}_${i}.png`)
      }
      img.src = `sprites/player/${anim}/${anim}_${i}.png`
      animData.frames.push(img)
    }

    playerSprites[anim as PlayerAnim] = animData
  }
}

export function getPlayerAnim(): PlayerAnim {
  const player = state.player
  if (player.rolling) return 'roll'
  if (player.diving) return 'run'
  if (player.doubleJumping) return 'roll'
  if (player.crouching) return 'crouch'
  if (player.uncrouchTimer > 0 && player.onGround) return 'uncrouch'
  if (!player.onGround) return 'jump'
  if (player.landingTimer > 0) return 'land'
  if (Math.abs(player.vx) > 5) return 'run'
  return 'idle'
}

export function drawSprite(anim: SpriteAnim, x: number, y: number, flipX: boolean, rotation = 0, loop = true, anchorBottom = false, forceFrame = -1): boolean {
  if (!anim.loaded) return false
  const ctx = state.ctx!

  const rawFrame = Math.floor(state.animTimer * anim.fps)
  const frameIdx = forceFrame >= 0 ? forceFrame : (loop ? rawFrame % anim.frames.length : Math.min(rawFrame, anim.frames.length - 1))
  const img = anim.frames[frameIdx]
  const drawW = SPRITE_FRAME_SIZE
  const drawH = SPRITE_FRAME_SIZE

  const player = state.player
  const centerX = x + player.w / 2
  const diveOffset = (anchorBottom && frameIdx >= 2) ? DIVE_SPRITE_Y_OFFSET : 0
  const centerY = anchorBottom
    ? (y + player.h) - drawH / 2 + diveOffset
    : y + player.h / 2

  ctx.save()
  ctx.translate(centerX, centerY)
  if (rotation) ctx.rotate(rotation)
  if (flipX) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
  return true
}
