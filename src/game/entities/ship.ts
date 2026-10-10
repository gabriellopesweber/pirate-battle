import type { ShipStats } from '@/game/config/gameConfig'
import type { EntityId } from '@/game/core/entityStore'
import type { Vec2 } from '@/game/core/vector'

export type ShipKind = 'player' | 'chaser' | 'shooter'

export interface Ship {
  readonly id: EntityId
  readonly kind: ShipKind
  position: Vec2
  /** Direction the bow points to, in radians. */
  heading: number
  /** Current forward speed; ships never move backwards. */
  speed: number
  health: number
  readonly maxHealth: number
  readonly radius: number
}

/** What a ship wants to do this step — from player input or from enemy AI. */
export interface ShipControls {
  thrust: boolean
  /** -1 turns left (counter-clockwise on screen), 1 turns right. */
  turn: -1 | 0 | 1
}

export const IDLE_CONTROLS: Readonly<ShipControls> = Object.freeze({ thrust: false, turn: 0 })

export function createShip(
  id: EntityId,
  kind: ShipKind,
  stats: ShipStats,
  position: Vec2,
  heading: number,
): Ship {
  return {
    id,
    kind,
    position: { ...position },
    heading,
    speed: 0,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    radius: stats.radius,
  }
}
