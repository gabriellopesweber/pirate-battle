import type { CSSProperties } from 'react'
import type { Spritesheet } from 'pixi.js'
import { ASSET_BASE } from '@/render/assets'

interface AtlasSpriteProps {
  sheet: Spritesheet
  frame: string
  /** Rendered width in CSS pixels; height follows the frame's aspect ratio. */
  width: number
  className?: string
}

/**
 * A frame of a texture atlas drawn by CSS, for React interface elements.
 *
 * It points at the same atlas image PixiJS already loaded — 1× or 2× by
 * screen density — so the interface adds no download. Atlas frames are in
 * logical units, so the same arithmetic serves both densities.
 */
export function AtlasSprite({ sheet, frame, width, className }: AtlasSpriteProps) {
  const texture = sheet.textures[frame]
  if (!texture) return null
  const { x, y, width: frameWidth, height: frameHeight } = texture.frame
  const scale = width / frameWidth
  const style: CSSProperties = {
    display: 'inline-block',
    width: `${String(width)}px`,
    height: `${String(frameHeight * scale)}px`,
    backgroundImage: `url("${ASSET_BASE}${sheet.data.meta.image ?? ''}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${String(texture.source.width * scale)}px ${String(texture.source.height * scale)}px`,
    backgroundPosition: `${String(-x * scale)}px ${String(-y * scale)}px`,
  }
  return <span aria-hidden="true" className={className} style={style} />
}
