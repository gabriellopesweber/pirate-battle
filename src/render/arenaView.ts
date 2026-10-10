import { Container, Rectangle, Sprite, type Spritesheet, Texture, TilingSprite } from 'pixi.js'
import type { Arena } from '@/game/world/arena'
import { TILE } from '@/render/frames'

/**
 * Water and islands, built once per match.
 *
 * The sand art is a single 3 × 3 island, drawn so its nine pieces join only
 * in that arrangement: an island assembled tile by tile shows seams wherever
 * two pieces meet that were not neighbours in the art (both edges of a 2-wide
 * island, or an edge repeated beside itself). So each island is drawn as the
 * whole 3 × 3 artwork, stretched to the island's box — no joins, no seams.
 *
 * Only the picture is stretched. The rules collide with the land tiles of the
 * same islands (`Arena.isLand`), so what blocks a ship is still the box drawn
 * here.
 */
export function createArenaView(arena: Arena, tiles: Spritesheet): Container {
  const view = new Container({ label: 'arena' })
  const water = tiles.textures[TILE.water]
  if (water) view.addChild(new TilingSprite({ texture: water, width: arena.width, height: arena.height }))

  const island = islandTexture(tiles, arena.tileSize)
  if (island) {
    for (const box of arena.islands) {
      const sprite = new Sprite({ texture: island, x: box.left, y: box.top })
      sprite.setSize(box.right - box.left, box.bottom - box.top)
      view.addChild(sprite)
    }
    // The cut is this view's own texture (the atlas stays shared): free it
    // with the view, or every restart would leak one.
    view.once('destroyed', () => {
      island.destroy()
    })
  }

  // The arena never changes during a match: draw it once into a texture
  // instead of re-drawing it every frame. Resolution 2 keeps it sharp when
  // the letterbox scales the world up.
  view.cacheAsTexture({ resolution: 2 })
  return view
}

/** The full 3 × 3 sand island as one texture, cut from the tilesheet. */
function islandTexture(tiles: Spritesheet, tileSize: number): Texture | undefined {
  const topLeft = tiles.textures[TILE.island]
  if (!topLeft) return undefined
  // Atlas frames are in logical units, so this cut works for the 1× and 2× sheets.
  return new Texture({
    source: topLeft.source,
    frame: new Rectangle(topLeft.frame.x, topLeft.frame.y, tileSize * 3, tileSize * 3),
  })
}
