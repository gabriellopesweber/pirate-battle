// Derives the runtime asset files in public/game/ from the source assets in
// assets/. Runs before `vite` and `vite build`; the output is git-ignored.
// See assets/README.md for why each conversion exists.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets')
const OUT = join(ROOT, 'public', 'game')
const TILE_SIZE = 64

interface Frame {
  frame: { x: number; y: number; w: number; h: number }
  rotated: false
  trimmed: false
  spriteSourceSize: { x: 0; y: 0; w: number; h: number }
  sourceSize: { w: number; h: number }
}

interface Atlas {
  frames: Record<string, unknown>
  meta: { image: string; size: { w: number; h: number }; scale: string } & Record<string, unknown>
}

function pngSize(file: string): { w: number; h: number } {
  const bytes = readFileSync(file)
  // IHDR: width and height are the big-endian words at offsets 16 and 20.
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) }
}

function frame(x: number, y: number, w: number, h: number): Frame {
  return {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
  }
}

function writeAtlas(name: string, atlas: Atlas): void {
  writeFileSync(join(OUT, name), JSON.stringify(atlas))
}

function shipsAtlas(): void {
  const xml = readFileSync(join(SOURCE, 'spritesheet', 'ships_miscellaneous_sheet.xml'), 'utf8')
  const frames: Record<string, Frame> = {}
  const pattern = /<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g
  for (const [, name = '', x, y, w, h] of xml.matchAll(pattern)) {
    frames[name.replace(/\.png$/, '')] = frame(Number(x), Number(y), Number(w), Number(h))
  }
  if (Object.keys(frames).length === 0) throw new Error('No SubTexture found in the ships atlas')

  const image = join(SOURCE, 'spritesheet', 'ships_miscellaneous_sheet.png')
  copyFileSync(image, join(OUT, 'ships.png'))
  writeAtlas('ships.json', { frames, meta: { image: 'ships.png', size: pngSize(image), scale: '1' } })
}

function tilesAtlas(suffix: '' | '@2x', source: string, scale: 1 | 2): void {
  const image = join(SOURCE, 'tilesheet', source)
  const size = pngSize(image)
  const cell = TILE_SIZE * scale
  const frames: Record<string, Frame> = {}
  for (let row = 0; row < size.h / cell; row++) {
    for (let col = 0; col < size.w / cell; col++) {
      frames[`tile_${String(row)}_${String(col)}`] = frame(col * cell, row * cell, cell, cell)
    }
  }
  copyFileSync(image, join(OUT, `tiles${suffix}.png`))
  writeAtlas(`tiles${suffix}.json`, { frames, meta: { image: `tiles${suffix}.png`, size, scale: String(scale) } })
}

function uiAtlas(suffix: '' | '@2x', source: string): void {
  const atlas = JSON.parse(readFileSync(join(SOURCE, 'spritesheet', `${source}.json`), 'utf8')) as Atlas
  copyFileSync(join(SOURCE, 'spritesheet', `${source}.png`), join(OUT, `ui${suffix}.png`))
  writeAtlas(`ui${suffix}.json`, { ...atlas, meta: { ...atlas.meta, image: `ui${suffix}.png` } })
}

function sounds(): void {
  mkdirSync(join(OUT, 'sounds'))
  for (const file of readdirSync(join(SOURCE, 'sounds'))) {
    if (file.endsWith('.wav')) copyFileSync(join(SOURCE, 'sounds', file), join(OUT, 'sounds', file))
  }
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
shipsAtlas()
tilesAtlas('', 'tiles_sheet.png', 1)
tilesAtlas('@2x', 'tiles_sheet_retina.png', 2)
uiAtlas('', 'ui_sheet')
uiAtlas('@2x', 'ui_sheet_retina')
copyFileSync(join(SOURCE, 'ui_scene_background.png'), join(OUT, 'background.png'))
sounds()
console.log(`Assets written to ${OUT}`)
