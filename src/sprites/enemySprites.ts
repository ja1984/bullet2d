// ─── Enemy Sprite System ─────────────────────────────────────────────────────

import type { Enemy, EnemyAnim, EnemyTypeDef, SpriteAnim } from '../types'
import { ENEMY_SPRITE_FRAME_SIZE } from '../constants'
import { state } from '../state'

export const enemyTypes: Record<string, EnemyTypeDef> = {}

export function loadEnemySprites(typeName: string, config: Record<EnemyAnim, { frames: number; fps: number }>) {
  const def: EnemyTypeDef = {
    sprites: {} as any,
    spriteConfig: config,
  }

  for (const [anim, cfg] of Object.entries(config)) {
    const animData: SpriteAnim = {
      frames: [],
      fps: cfg.fps,
      loaded: false,
    }

    let animLoaded = 0
    for (let i = 0; i < cfg.frames; i++) {
      const img = new Image()
      img.onload = () => {
        animLoaded++
        if (animLoaded === cfg.frames) {
          animData.loaded = true
          console.log(`Enemy ${typeName}/${anim} sprites loaded!`)
        }
      }
      img.onerror = () => {
        console.warn(`Sprite not found: sprites/enemies/${typeName}/${anim}/${anim}_${i}.png`)
      }
      img.src = `sprites/enemies/${typeName}/${anim}/${anim}_${i}.png`
      animData.frames.push(img)
    }

    def.sprites[anim as EnemyAnim] = animData
  }

  enemyTypes[typeName] = def
}

export function getEnemyAnim(e: Enemy): EnemyAnim {
  if (e.state === 'dead') return 'death'
  if (e.hitTimer > 0) return 'hit'
  if (e.state === 'idle' && Math.abs(e.vx) > 10) return 'walk'
  return 'idle'
}

export function drawEnemySprite(e: Enemy): boolean {
  const typeDef = enemyTypes[e.type]
  if (!typeDef) return false

  const anim = getEnemyAnim(e)
  if (anim !== e.currentAnim) {
    e.currentAnim = anim
    e.animTimer = 0
  }

  const sheet = typeDef.sprites[anim]
  if (!sheet?.loaded) return false

  const ctx = state.ctx!
  const shouldLoop = anim !== 'hit' && anim !== 'death'
  const rawFrame = Math.floor(e.animTimer * sheet.fps)
  const frameIdx = shouldLoop ? rawFrame % sheet.frames.length : Math.min(rawFrame, sheet.frames.length - 1)
  const img = sheet.frames[frameIdx]

  const flipX = e.facing < 0
  const centerX = e.x + e.w / 2
  const centerY = e.y + e.h / 2

  ctx.save()
  ctx.translate(centerX, centerY)
  if (flipX) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -ENEMY_SPRITE_FRAME_SIZE / 2, -ENEMY_SPRITE_FRAME_SIZE / 2, ENEMY_SPRITE_FRAME_SIZE, ENEMY_SPRITE_FRAME_SIZE)
  ctx.restore()
  return true
}
