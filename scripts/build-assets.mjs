// @ts-check
// Derives the runtime asset files in public/game/ from the source assets in
// assets/. Runs before `vite` and `vite build`; the output is git-ignored.
// See assets/README.md for why each conversion exists.
//
// Plain JavaScript, type-checked through JSDoc (`checkJs` in
// tsconfig.node.json), so Node runs it without type-stripping flags.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets')
const OUT = join(ROOT, 'public', 'game')
const TILE_SIZE = 64

/**
 * @typedef {{ w: number, h: number }} Size
 * @typedef {{
 *   frame: { x: number, y: number, w: number, h: number },
 *   rotated: false,
 *   trimmed: false,
 *   spriteSourceSize: { x: 0, y: 0, w: number, h: number },
 *   sourceSize: Size,
 * }} Frame
 * @typedef {{
 *   frames: Record<string, unknown>,
 *   meta: { image: string, size: Size, scale: string } & Record<string, unknown>,
 * }} Atlas
 */

/**
 * @param {string} file
 * @returns {Size}
 */
function pngSize(file) {
  const bytes = readFileSync(file)
  // IHDR: width and height are the big-endian words at offsets 16 and 20.
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {Frame}
 */
function frame(x, y, w, h) {
  return {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
  }
}

/**
 * @param {string} name
 * @param {Atlas} atlas
 */
function writeAtlas(name, atlas) {
  writeFileSync(join(OUT, name), JSON.stringify(atlas))
}

function shipsAtlas() {
  const xml = readFileSync(join(SOURCE, 'spritesheet', 'ships_miscellaneous_sheet.xml'), 'utf8')
  /** @type {Record<string, Frame>} */
  const frames = {}
  const pattern = /<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g
  for (const [, name = '', x, y, w, h] of xml.matchAll(pattern)) {
    frames[name.replace(/\.png$/, '')] = frame(Number(x), Number(y), Number(w), Number(h))
  }
  if (Object.keys(frames).length === 0) throw new Error('No SubTexture found in the ships atlas')

  const image = join(SOURCE, 'spritesheet', 'ships_miscellaneous_sheet.png')
  copyFileSync(image, join(OUT, 'ships.png'))
  writeAtlas('ships.json', { frames, meta: { image: 'ships.png', size: pngSize(image), scale: '1' } })
}

/**
 * @param {'' | '@2x'} suffix
 * @param {string} source
 * @param {1 | 2} scale
 */
function tilesAtlas(suffix, source, scale) {
  const image = join(SOURCE, 'tilesheet', source)
  const size = pngSize(image)
  const cell = TILE_SIZE * scale
  /** @type {Record<string, Frame>} */
  const frames = {}
  for (let row = 0; row < size.h / cell; row++) {
    for (let col = 0; col < size.w / cell; col++) {
      frames[`tile_${String(row)}_${String(col)}`] = frame(col * cell, row * cell, cell, cell)
    }
  }
  copyFileSync(image, join(OUT, `tiles${suffix}.png`))
  writeAtlas(`tiles${suffix}.json`, { frames, meta: { image: `tiles${suffix}.png`, size, scale: String(scale) } })
}

/**
 * @param {'' | '@2x'} suffix
 * @param {string} source
 */
function uiAtlas(suffix, source) {
  const atlas = /** @type {Atlas} */ (JSON.parse(readFileSync(join(SOURCE, 'spritesheet', `${source}.json`), 'utf8')))
  copyFileSync(join(SOURCE, 'spritesheet', `${source}.png`), join(OUT, `ui${suffix}.png`))
  writeAtlas(`ui${suffix}.json`, { ...atlas, meta: { ...atlas.meta, image: `ui${suffix}.png` } })
}

function sounds() {
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
