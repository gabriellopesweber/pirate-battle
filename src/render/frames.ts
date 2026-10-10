import type { ShipKind } from '@/game/entities/ship'

// Frame names in the generated atlases (see assets/README.md).
//
// The ships atlas holds six hull colours in four stages: ship_1-6 intact,
// ship_7-12 damaged, ship_13-18 badly damaged, ship_19-24 wrecked, each block
// ordered white, black, red, green, blue, yellow.
const COLOUR_INDEX: Record<ShipKind, number> = {
  player: 5, // blue
  chaser: 2, // black, skull flag
  shooter: 3, // red
}

export type DamageStage = 0 | 1 | 2 | 3

/** 0 intact, 1 damaged, 2 badly damaged, 3 wrecked — from the remaining health. */
export function damageStage(health: number, maxHealth: number): DamageStage {
  if (health <= 0) return 3
  const ratio = health / maxHealth
  if (ratio > 2 / 3) return 0
  if (ratio > 1 / 3) return 1
  return 2
}

export function shipFrame(kind: ShipKind, stage: DamageStage): string {
  return `ship_${String(COLOUR_INDEX[kind] + stage * 6)}`
}

/**
 * Direction the hull sprites face when unrotated: bow down, +y. The
 * simulation's angle 0 points right, so a hull is rotated by
 * `heading - SPRITE_FACING`.
 */
export const SPRITE_FACING = Math.PI / 2

export const TILE = {
  water: 'tile_4_8',
  // Top-left tile of the 3 × 3 sand island in the corner of the tilesheet.
  island: 'tile_0_0',
} as const

export const EFFECT = {
  explosion: ['explosion_1', 'explosion_2', 'explosion_3'],
  fire: ['fire_1', 'fire_2'],
  cannonball: 'cannon_ball',
  debris: ['wood_1', 'wood_2', 'wood_3', 'wood_4'],
} as const
