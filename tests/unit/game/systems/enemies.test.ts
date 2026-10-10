import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import { angleTo, distance, type Vec2 } from '@/game/core/vector'
import { createEnemy, type EnemyKind } from '@/game/entities/enemy'
import { destroyShip } from '@/game/systems/combat'
import { circleHitsLand } from '@/game/world/arena'
import type { GameEvent } from '@/game/world/events'
import { IDLE_PLAYER_INPUT, type World } from '@/game/world/state'
import { createWorld, stepWorld } from '@/game/world/world'

// Enemies are placed by hand here; the spawner stays off.
function testConfig(edit?: (config: GameConfig) => void): GameConfig {
  const config = structuredClone(DEFAULT_GAME_CONFIG)
  config.spawn.intervalSeconds = Number.POSITIVE_INFINITY
  edit?.(config)
  return config
}

const DT = DEFAULT_GAME_CONFIG.simulation.stepSeconds

function run(world: World, seconds: number, each?: () => void): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepWorld(world, { player: IDLE_PLAYER_INPUT }, DT)
    events.push(...world.events)
    each?.()
  }
  return events
}

function place(world: World, kind: EnemyKind, position: Vec2, heading?: number) {
  return world.enemies.add((id) =>
    createEnemy(id, kind, world.config, position, heading ?? angleTo(position, world.player.position)),
  )
}

// The player starts at (800, 448).
describe('Chaser', () => {
  it('rams the player once, dealing contact damage, and explodes without scoring', () => {
    const world = createWorld(testConfig(), 1)
    const chaser = place(world, 'chaser', { x: 1150, y: 448 })

    const events = run(world, 5)

    const destroyed = events.filter((e) => e.type === 'destroyed')
    expect(destroyed).toEqual([expect.objectContaining({ shipId: chaser.id, cause: 'ram' })])
    expect(world.player.health).toBe(DEFAULT_GAME_CONFIG.player.maxHealth - DEFAULT_GAME_CONFIG.chaser.contactDamage)
    expect(world.enemies.size).toBe(0)
  })

  it('turns around to chase a player behind it', () => {
    const world = createWorld(testConfig(), 1)
    place(world, 'chaser', { x: 1150, y: 448 }, 0)

    const events = run(world, 6)

    expect(events.some((e) => e.type === 'destroyed' && e.cause === 'ram')).toBe(true)
  })

  it('never sails into an island while chasing across it', () => {
    const world = createWorld(testConfig(), 1)
    // Player north of the top-left island, Chaser south of it.
    world.player.position = { x: 320, y: 60 }
    const chaser = place(world, 'chaser', { x: 300, y: 560 })
    const start = distance(chaser.position, world.player.position)
    let closest = start

    run(world, 10, () => {
      if (!world.enemies.has(chaser.id)) return
      expect(circleHitsLand(world.arena, chaser.position, chaser.radius)).toBe(false)
      closest = Math.min(closest, distance(chaser.position, world.player.position))
    })

    expect(closest).toBeLessThan(start / 2)
  })
})

describe('Shooter', () => {
  it('approaches and holds near its preferred distance', () => {
    const world = createWorld(testConfig(), 1)
    const shooter = place(world, 'shooter', { x: 1450, y: 448 })

    run(world, 8)

    const { preferredDistance } = DEFAULT_GAME_CONFIG.shooter
    const gap = distance(shooter.position, world.player.position)
    expect(gap).toBeLessThan(preferredDistance + 10)
    expect(gap).toBeGreaterThan(preferredDistance - 60)
  })

  it('fires only within attack range, aimed at the player, at its cooldown', () => {
    const config = testConfig((c) => {
      c.shooter = { ...c.shooter, maxSpeed: 0, acceleration: 0, turnSpeed: 0 }
    })
    const near = createWorld(config, 1)
    const far = createWorld(config, 1)
    const { attackRange, weapon } = config.shooter
    const shooter = place(near, 'shooter', { x: 800 + attackRange - 50, y: 448 })
    place(far, 'shooter', { x: 800 + attackRange + 50, y: 448 })

    const nearShots = run(near, 2).filter((e) => e.type === 'shot')
    const farShots = run(far, 2).filter((e) => e.type === 'shot')

    // 2 s with a 1.8 s cooldown: at 0 s and 1.8 s.
    expect(nearShots).toHaveLength(2)
    expect(farShots).toHaveLength(0)
    expect(nearShots[0]).toMatchObject({ side: 'enemy', weapon: 'shooter', shipId: shooter.id })
    expect(nearShots[0]?.type === 'shot' && nearShots[0].angle).toBeCloseTo(Math.PI, 6)
    expect(near.player.health).toBeLessThanOrEqual(config.player.maxHealth - weapon.damage)
  })

  it('stops firing once destroyed', () => {
    const world = createWorld(testConfig(), 1)
    const shooter = place(world, 'shooter', { x: 1100, y: 448 })
    destroyShip(world, shooter, 'player-fire')

    const shots = run(world, 3).filter((e) => e.type === 'shot')

    expect(shots).toHaveLength(0)
    expect(world.enemies.size).toBe(0)
  })
})
