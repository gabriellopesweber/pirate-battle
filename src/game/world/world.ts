import type { GameConfig } from '@/game/config/gameConfig'
import { createIdAllocator, type EntityId } from '@/game/core/entityStore'
import { createRng, type Rng } from '@/game/core/rng'
import { createShip, type Ship, type ShipControls } from '@/game/entities/ship'
import { moveShip } from '@/game/systems/movement'
import { type Arena, circleIsClear, createArena } from '@/game/world/arena'

/** Everything the rules need for one match. Plain data, no rendering. */
export interface World {
  readonly config: Readonly<GameConfig>
  readonly arena: Arena
  readonly rng: Rng
  readonly nextId: () => EntityId
  readonly player: Ship
  /** Simulation time elapsed in this match. */
  time: number
}

export interface StepInput {
  player: ShipControls
}

export function createWorld(config: Readonly<GameConfig>, seed: number): World {
  const arena = createArena(config.arena)
  const nextId = createIdAllocator()
  const spawn = config.arena.playerSpawn
  if (!circleIsClear(arena, spawn, config.player.radius)) {
    throw new Error('The player spawn point must be open water')
  }
  // Bow pointing up, towards the open top of the arena.
  const player = createShip(nextId(), 'player', config.player, spawn, -Math.PI / 2)

  return { config, arena, rng: createRng(seed), nextId, player, time: 0 }
}

/** One fixed simulation step. Systems are called in a fixed order. */
export function stepWorld(world: World, input: StepInput, dt: number): void {
  moveShip(world.player, input.player, world.config.player, world.arena, dt)
  world.time += dt
}
