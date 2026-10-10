import type { ArenaConfig } from '@/game/config/gameConfig'
import { clamp, type Vec2 } from '@/game/core/vector'

/**
 * The arena as a grid of tiles, each water or land.
 *
 * Islands are authored as tile rectangles and rasterised here once, so the
 * renderer draws exactly the cells the rules collide with — what the player
 * sees blocking a ship is what blocks it.
 */
export interface Arena {
  readonly tileSize: number
  readonly cols: number
  readonly rows: number
  readonly width: number
  readonly height: number
  isLand(col: number, row: number): boolean
  /** Land at a world position. Outside the arena counts as land. */
  isLandAt(x: number, y: number): boolean
}

export function createArena(config: ArenaConfig): Arena {
  const { tileSize, cols, rows } = config
  const land = new Uint8Array(cols * rows)

  for (const island of config.islands) {
    for (const rect of island) {
      for (let row = rect.row; row < rect.row + rect.rows; row++) {
        for (let col = rect.col; col < rect.col + rect.cols; col++) {
          if (col < 0 || row < 0 || col >= cols || row >= rows) {
            throw new Error(`Island tile (${String(col)}, ${String(row)}) is outside the arena`)
          }
          land[row * cols + col] = 1
        }
      }
    }
  }

  const isLand = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return false
    return land[row * cols + col] === 1
  }

  return {
    tileSize,
    cols,
    rows,
    width: cols * tileSize,
    height: rows * tileSize,
    isLand,
    isLandAt: (x, y) => {
      if (x < 0 || y < 0 || x >= cols * tileSize || y >= rows * tileSize) return true
      return isLand(Math.floor(x / tileSize), Math.floor(y / tileSize))
    },
  }
}

/** True when a circle overlaps any land tile. */
export function circleHitsLand(arena: Arena, center: Vec2, radius: number): boolean {
  let hit = false
  forEachLandTileNear(arena, center, radius, (left, top) => {
    if (!hit && closestDistanceSq(center, left, top, arena.tileSize) < radius * radius) hit = true
  })
  return hit
}

/** True when a circle fits inside the arena and touches no land. */
export function circleIsClear(arena: Arena, center: Vec2, radius: number): boolean {
  return (
    center.x - radius >= 0 &&
    center.y - radius >= 0 &&
    center.x + radius <= arena.width &&
    center.y + radius <= arena.height &&
    !circleHitsLand(arena, center, radius)
  )
}

/**
 * Pushes a circle out of land tiles and back inside the arena, in place.
 * Returns true if the circle had to be moved.
 *
 * Each overlapping tile pushes the circle along the line from the tile's
 * closest point to the circle's centre, which lets a ship slide along a
 * coastline instead of sticking to it. Two passes settle inner corners where
 * two tiles push at once.
 */
export function resolveCircleAgainstArena(arena: Arena, center: Vec2, radius: number): boolean {
  let moved = false
  for (let pass = 0; pass < 2; pass++) {
    forEachLandTileNear(arena, center, radius, (left, top) => {
      if (pushOutOfTile(center, radius, left, top, arena.tileSize)) moved = true
    })
  }

  const x = clamp(center.x, radius, arena.width - radius)
  const y = clamp(center.y, radius, arena.height - radius)
  if (x !== center.x || y !== center.y) {
    center.x = x
    center.y = y
    moved = true
  }
  return moved
}

function forEachLandTileNear(
  arena: Arena,
  center: Vec2,
  radius: number,
  visit: (left: number, top: number) => void,
): void {
  const size = arena.tileSize
  const minCol = Math.floor((center.x - radius) / size)
  const maxCol = Math.floor((center.x + radius) / size)
  const minRow = Math.floor((center.y - radius) / size)
  const maxRow = Math.floor((center.y + radius) / size)
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (arena.isLand(col, row)) visit(col * size, row * size)
    }
  }
}

function closestDistanceSq(center: Vec2, left: number, top: number, size: number): number {
  const nearestX = clamp(center.x, left, left + size)
  const nearestY = clamp(center.y, top, top + size)
  return (center.x - nearestX) ** 2 + (center.y - nearestY) ** 2
}

function pushOutOfTile(center: Vec2, radius: number, left: number, top: number, size: number): boolean {
  const nearestX = clamp(center.x, left, left + size)
  const nearestY = clamp(center.y, top, top + size)
  const dx = center.x - nearestX
  const dy = center.y - nearestY
  const distSq = dx * dx + dy * dy
  if (distSq >= radius * radius) return false

  if (distSq > 0) {
    const dist = Math.sqrt(distSq)
    const push = radius - dist
    center.x += (dx / dist) * push
    center.y += (dy / dist) * push
    return true
  }

  // Centre inside the tile (only after a teleport or a huge step): leave by
  // the nearest edge.
  const exits = [
    { d: center.x - left, x: left - radius, y: center.y },
    { d: left + size - center.x, x: left + size + radius, y: center.y },
    { d: center.y - top, x: center.x, y: top - radius },
    { d: top + size - center.y, x: center.x, y: top + size + radius },
  ]
  const nearest = exits.reduce((best, exit) => (exit.d < best.d ? exit : best))
  center.x = nearest.x
  center.y = nearest.y
  return true
}
