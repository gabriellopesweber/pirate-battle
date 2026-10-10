import type { GameConfig } from '@/game/config/gameConfig'
import { createIdAllocator, EntityStore } from '@/game/core/entityStore'
import { createRng } from '@/game/core/rng'
import type { Projectile } from '@/game/entities/projectile'
import { createShip, type Ship } from '@/game/entities/ship'
import { readyCooldown, tickCooldown } from '@/game/systems/cooldown'
import { moveShip } from '@/game/systems/movement'
import { updateProjectiles } from '@/game/systems/projectiles'
import { broadsideOffsets, fireVolley } from '@/game/systems/weapons'
import { circleIsClear, createArena } from '@/game/world/arena'
import type { PlayerInput, StepInput, World } from '@/game/world/state'

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
