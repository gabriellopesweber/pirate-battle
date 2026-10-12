import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import { angleTo, distance, type Vec2 } from '@/game/core/vector'
import { createEnemy, type EnemyKind } from '@/game/entities/enemy'
import { destroyShip } from '@/game/systems/combat'
import { hasLineOfSight, waypoint } from '@/game/systems/enemyAi'
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
    // Player north of the 3 × 3 island (x 192-384, y 128-320), Chaser south of it.
    world.player.position = { x: 288, y: 60 }
    const chaser = place(world, 'chaser', { x: 288, y: 440 })
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

describe('waypoint', () => {
  // The 3 × 3 island spans x 192-384, y 128-320.
  it('heads straight for the player when nothing is in the way', () => {
    const world = createWorld(testConfig(), 1)
    const chaser = place(world, 'chaser', { x: 600, y: 600 })

    expect(waypoint(world.arena, chaser, world.player.position)).toEqual(world.player.position)
  })

  it('heads for a reachable corner of the island in the way', () => {
    const world = createWorld(testConfig(), 1)
    const chaser = place(world, 'chaser', { x: 288, y: 440 })
    const goal = { x: 288, y: 60 }

    const corner = waypoint(world.arena, chaser, goal)

    // Straight below the island with the goal straight above it, no corner
    // the ship can see also sees the goal: it takes a near corner first, and
    // re-picking every step chains it to the far one.
    const island = world.arena.islands[0]
    const margin = chaser.radius + 20
    expect([(island?.left ?? 0) - margin, (island?.right ?? 0) + margin]).toContain(corner.x)
    expect(corner.y).toBe((island?.bottom ?? 0) + margin)
    expect(hasLineOfSight(world.arena, chaser.position, corner, chaser.radius)).toBe(true)
  })

  it('takes the corner that sees the goal once one is in view', () => {
    const world = createWorld(testConfig(), 1)
    // At the island's bottom-left corner, the top-left corner is in view and sees the goal.
    const chaser = place(world, 'chaser', { x: 150, y: 362 })
    const goal = { x: 288, y: 60 }

    const corner = waypoint(world.arena, chaser, goal)

    expect(hasLineOfSight(world.arena, corner, goal, chaser.radius)).toBe(true)
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

  it('keeps sailing round an island that hides a player already within its preferred distance', () => {
    const world = createWorld(testConfig(), 1)
    // Player north of the 3 × 3 island (x 192-384, y 128-320), Shooter just south
    // of it: 290 px apart — inside the preferred 300 — with the island between.
    world.player.position = { x: 288, y: 60 }
    const shooter = place(world, 'shooter', { x: 288, y: 350 })
    expect(distance(shooter.position, world.player.position)).toBeLessThan(DEFAULT_GAME_CONFIG.shooter.preferredDistance)
    expect(hasLineOfSight(world.arena, shooter.position, world.player.position, shooter.radius)).toBe(false)
    let sawThePlayer = false

    run(world, 8, () => {
      expect(circleHitsLand(world.arena, shooter.position, shooter.radius)).toBe(false)
      sawThePlayer ||= hasLineOfSight(world.arena, shooter.position, world.player.position, shooter.radius)
    })

    expect(sawThePlayer).toBe(true)
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
