import type { GameConfig } from '@/game/config/gameConfig'
import { createIdAllocator, type EntityId, EntityStore } from '@/game/core/entityStore'
import { createRng, type Rng } from '@/game/core/rng'
import type { Projectile } from '@/game/entities/projectile'
import { createShip, type Ship, type ShipControls } from '@/game/entities/ship'
import { moveShip } from '@/game/systems/movement'
import { updateProjectiles } from '@/game/systems/projectiles'
import {
  broadsideOffsets,
  type Cooldown,
  fireVolley,
  readyCooldown,
  tickCooldown,
} from '@/game/systems/weapons'
import { type Arena, circleIsClear, createArena } from '@/game/world/arena'
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
  readonly enemies: EntityStore<Ship>
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

export function createWorld(config: Readonly<GameConfig>, seed: number): World {
  const arena = createArena(config.arena)
  const nextId = createIdAllocator()
  const spawn = config.arena.playerSpawn
  if (!circleIsClear(arena, spawn, config.player.radius)) {
    throw new Error('The player spawn point must be open water')
  }
  // Bow pointing up, towards the open top of the arena.
  const player = createShip(nextId(), 'player', config.player, spawn, -Math.PI / 2)

  return {
    config,
    arena,
    rng: createRng(seed),
    nextId,
    player,
    playerWeapons: { front: readyCooldown(), left: readyCooldown(), right: readyCooldown() },
    enemies: new EntityStore<Ship>(nextId),
    projectiles: new EntityStore<Projectile>(nextId),
    events: [],
    time: 0,
  }
}

/** One fixed simulation step. Systems run in a fixed order. */
export function stepWorld(world: World, input: StepInput, dt: number): void {
  world.events = []
  moveShip(world.player, input.player, world.config.player, world.arena, dt)
  firePlayerWeapons(world, input.player, dt)
  updateProjectiles(world, dt)
  world.enemies.flush()
  world.projectiles.flush()
  world.time += dt
}

function firePlayerWeapons(world: World, input: PlayerInput, dt: number): void {
  const { player, playerWeapons: weapons, config } = world
  tickCooldown(weapons.front, dt)
  tickCooldown(weapons.left, dt)
  tickCooldown(weapons.right, dt)
  if (player.health <= 0) return

  const { frontWeapon, broadside } = config.player
  const offsets = broadsideOffsets(broadside.projectileCount, broadside.spacing)
  if (input.fireFront) fireVolley(world, player, 'player', 'front', frontWeapon, weapons.front, player.heading)
  // On screen (y down), the port side is a quarter turn counter-clockwise.
  if (input.fireLeft) {
    fireVolley(world, player, 'player', 'left', broadside, weapons.left, player.heading - Math.PI / 2, offsets)
  }
  if (input.fireRight) {
    fireVolley(world, player, 'player', 'right', broadside, weapons.right, player.heading + Math.PI / 2, offsets)
  }
}
