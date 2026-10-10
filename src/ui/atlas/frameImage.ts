import type { Spritesheet } from 'pixi.js'

const cache = new WeakMap<Spritesheet, Map<string, string>>()

/**
 * One atlas frame as a standalone image URL, for CSS that needs a whole
 * image of its own — `border-image` 9-slicing a panel, or button states.
 *
 * Cut once from the atlas image PixiJS already decoded (no new download) and
 * cached per sheet. The cut keeps the atlas density: a 2× sheet yields a 2×
 * image, so CSS sizes stay in logical pixels.
 */
export function frameImage(sheet: Spritesheet, frame: string): string {
  let frames = cache.get(sheet)
  if (!frames) {
    frames = new Map()
    cache.set(sheet, frames)
  }
  const cached = frames.get(frame)
  if (cached) return cached

  const texture = sheet.textures[frame]
  const resource = texture?.source.resource as CanvasImageSource | undefined
  if (!texture || !resource) return ''
  const { resolution } = texture.source
  const { x, y, width, height } = texture.frame
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * resolution)
  canvas.height = Math.round(height * resolution)
  canvas
    .getContext('2d')
    ?.drawImage(resource, x * resolution, y * resolution, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/png')
  frames.set(frame, url)
  return url
}
