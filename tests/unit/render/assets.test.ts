import { describe, expect, it } from 'vitest'
import { atlasUrls } from '@/render/assets'

describe('atlasUrls', () => {
  it('uses 1× atlases on standard screens', () => {
    expect(atlasUrls(1)).toEqual({ ships: '/game/ships.json', tiles: '/game/tiles.json', ui: '/game/ui.json' })
  })

  it('uses 2× tiles and UI on dense screens, but always 1× ships', () => {
    expect(atlasUrls(2)).toEqual({ ships: '/game/ships.json', tiles: '/game/tiles@2x.json', ui: '/game/ui@2x.json' })
  })
})
