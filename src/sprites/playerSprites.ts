// ─── Player Sprite System ────────────────────────────────────────────────────

import type { PlayerAnim, SpriteAnim } from '../types'
import type { PlayerSkin } from '../constants'
import { SPRITE_FRAME_SIZE, DIVE_SPRITE_Y_OFFSET, PLAYER_SKINS, spriteConfig } from '../constants'
import { state } from '../state'

// Store sprites per skin
const allSkinSprites: Record<PlayerSkin, Record<PlayerAnim, SpriteAnim>> = {} as any
const skinArmSprites: Record<PlayerSkin, HTMLImageElement> = {} as any

// Active sprites — these get swapped when skin changes
export let playerSprites: Record<PlayerAnim, SpriteAnim> = {} as any

export let spritesEnabled = false

export function loadPlayerSprites() {
  const skins = Object.entries(PLAYER_SKINS) as [PlayerSkin, typeof PLAYER_SKINS[PlayerSkin]][]
  let totalFrames = 0
  let loadedFrames = 0

  // Count total frames across all skins
  for (const [, skinDef] of skins) {
    for (const config of Object.values(skinDef.spriteConfig)) {
      totalFrames += config.frames
    }
  }

  for (const [skinId, skinDef] of skins) {
    const skinSprites: Record<string, SpriteAnim> = {}

    for (const [anim, config] of Object.entries(skinDef.spriteConfig)) {
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
          console.warn(`Sprite not found: ${skinDef.folder}/${anim}/${anim}_${i}.png`)
        }
        img.src = `${skinDef.folder}/${anim}/${anim}_${i}.png`
        animData.frames.push(img)
      }

      skinSprites[anim] = animData
    }

    allSkinSprites[skinId] = skinSprites as Record<PlayerAnim, SpriteAnim>

    // Load arm sprite
    const armImg = new Image()
    armImg.onload = () => console.log(`Arm sprite loaded for ${skinId}`)
    armImg.onerror = () => console.warn(`Arm sprite not found: ${skinDef.folder}/arm/arm_0.png`)
    armImg.src = `${skinDef.folder}/arm/arm_0.png`
    skinArmSprites[skinId] = armImg
  }

  // Set initial active skin
  setSkin(state.playerSkin)
}

export function setSkin(skinId: PlayerSkin) {
  state.playerSkin = skinId
  playerSprites = allSkinSprites[skinId]
  state.armSprite = skinArmSprites[skinId]
  localStorage.setItem('bulletTime2d_skin', skinId)
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

  // Use active skin's sprite config for frame count
  const skinConfig = PLAYER_SKINS[state.playerSkin].spriteConfig
  const animName = getPlayerAnim()
  const maxFrames = skinConfig[animName]?.frames ?? anim.frames.length

  const rawFrame = Math.floor(state.animTimer * anim.fps)
  const frameIdx = forceFrame >= 0 ? forceFrame : (loop ? rawFrame % maxFrames : Math.min(rawFrame, maxFrames - 1))
  const img = anim.frames[frameIdx]
  if (!img) return false
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
