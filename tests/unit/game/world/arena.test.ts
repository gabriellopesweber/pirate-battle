import { describe, expect, it } from 'vitest'
import { type ArenaConfig, DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { vec } from '@/game/core/vector'
import { circleHitsLand, circleIsClear, createArena, resolveCircleAgainstArena } from '@/game/world/arena'

// 10 × 6 tiles of 100 units, one L-shaped island:
//   cols 4-5, rows 2-3   plus   cols 4, row 4
const config: ArenaConfig = {
  tileSize: 100,
  cols: 10,
  rows: 6,
  islands: [
    [
      { col: 4, row: 2, cols: 2, rows: 2 },
      { col: 4, row: 4, cols: 1, rows: 1 },
    ],
  ],
  playerSpawn: { x: 150, y: 150 },
}

describe('createArena', () => {
  it('rasterises islands into land tiles', () => {
    const arena = createArena(config)

    expect(arena.width).toBe(1000)
    expect(arena.height).toBe(600)
    expect(arena.isLand(4, 2)).toBe(true)
    expect(arena.isLand(5, 3)).toBe(true)
    expect(arena.isLand(4, 4)).toBe(true)
    expect(arena.isLand(5, 4)).toBe(false)
    expect(arena.isLand(0, 0)).toBe(false)
  })

  it('treats positions outside the arena as land', () => {
    const arena = createArena(config)

    expect(arena.isLandAt(-1, 50)).toBe(true)
    expect(arena.isLandAt(50, 600)).toBe(true)
    expect(arena.isLandAt(450, 250)).toBe(true)
    expect(arena.isLandAt(50, 50)).toBe(false)
  })

  it('rejects islands outside the arena', () => {
    expect(() => createArena({ ...config, islands: [[{ col: 9, row: 0, cols: 2, rows: 1 }]] })).toThrow()
  })

  it('accepts the default layout, with the player spawn in open water', () => {
    const arena = createArena(DEFAULT_GAME_CONFIG.arena)

    expect(circleIsClear(arena, DEFAULT_GAME_CONFIG.arena.playerSpawn, DEFAULT_GAME_CONFIG.player.radius * 3)).toBe(true)
  })
})

describe('resolveCircleAgainstArena', () => {
  const arena = createArena(config)

  it('pushes a circle out of a tile edge', () => {
    const center = vec(390, 250)

    expect(resolveCircleAgainstArena(arena, center, 20)).toBe(true)
    expect(center.x).toBeCloseTo(380, 6)
    expect(center.y).toBe(250)
  })

  it('pushes a circle out of a convex corner diagonally', () => {
    const center = vec(395, 195)

    resolveCircleAgainstArena(arena, center, 20)

    expect(circleHitsLand(arena, center, 20)).toBe(false)
    expect(center.x).toBeLessThan(400)
    expect(center.y).toBeLessThan(200)
  })

  it('settles in the inner corner of an L-shaped island', () => {
    // Water tile (5, 4) is bounded by land above (5, 3) and to the left (4, 4).
    const center = vec(510, 410)

    resolveCircleAgainstArena(arena, center, 20)

    expect(circleHitsLand(arena, center, 20)).toBe(false)
    expect(center.x).toBeCloseTo(520, 6)
    expect(center.y).toBeCloseTo(420, 6)
  })

  it('escapes a tile it ended up inside of', () => {
    const center = vec(410, 300)

    resolveCircleAgainstArena(arena, center, 20)

    expect(circleHitsLand(arena, center, 20)).toBe(false)
  })

  it('keeps a circle inside the arena bounds', () => {
    const center = vec(-30, 700)

    resolveCircleAgainstArena(arena, center, 20)

    expect(center).toEqual({ x: 20, y: 580 })
  })

  it('leaves a circle in open water untouched', () => {
    const center = vec(150, 150)

    expect(resolveCircleAgainstArena(arena, center, 20)).toBe(false)
    expect(center).toEqual({ x: 150, y: 150 })
  })
})
