import type { EntityId } from '@/game/core/entityStore'
import type { Vec2 } from '@/game/core/vector'

/** Who fired a projectile — and therefore who it can hit. */
export type Side = 'player' | 'enemy'

export interface Projectile {
  readonly id: EntityId
  readonly side: Side
  position: Vec2
  readonly velocity: Vec2
  readonly damage: number
  readonly radius: number
  /** Seconds left before it falls into the sea. */
  lifetime: number
}
