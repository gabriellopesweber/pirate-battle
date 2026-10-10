// The shape of a match's state, kept apart from the code that steps it.
// Systems import these types from here, never from world.ts — world.ts
// imports the systems, and a cycle between them leaves editors resolving
// half-built types while files change.

import type { GameConfig } from '@/game/config/gameConfig'
import type { EntityId, EntityStore } from '@/game/core/entityStore'
import type { Rng } from '@/game/core/rng'
import type { Enemy } from '@/game/entities/enemy'
import type { Projectile } from '@/game/entities/projectile'
import type { Ship, ShipControls } from '@/game/entities/ship'
import type { Cooldown } from '@/game/systems/cooldown'
import type { Arena } from '@/game/world/arena'
import type { GameEvent } from '@/game/world/events'

/** Everything the rules need for one match. Plain data, no rendering. */
export interface World {
  readonly config: Readonly<GameConfig>
  readonly arena: Arena
  readonly rng: Rng
  readonly nextId: () => EntityId
  readonly player: Ship
  /** Front cannon and each broadside fire independently. */
  readonly playerWeapons: { front: Cooldown; left: Cooldown; right: Cooldown }
  readonly enemies: EntityStore<Enemy>
  /** Seconds to the next spawn, and how many enemies have spawned so far. */
  readonly spawner: { timer: number; count: number }
  readonly projectiles: EntityStore<Projectile>
  /** Events of the last step only; cleared at the start of each step. */
  events: GameEvent[]
  /** Simulation time elapsed in this match. */
  time: number
}

/** The player's intent for one step. Fire buttons repeat while held, at each weapon's cooldown. */
export interface PlayerInput extends ShipControls {
  fireFront: boolean
  fireLeft: boolean
  fireRight: boolean
}

export const IDLE_PLAYER_INPUT: Readonly<PlayerInput> = Object.freeze({
  thrust: false,
  turn: 0,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
})

export interface StepInput {
  player: PlayerInput
}
