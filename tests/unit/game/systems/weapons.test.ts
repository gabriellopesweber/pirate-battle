import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import type { Vec2 } from '@/game/core/vector'
import { createEnemy } from '@/game/entities/enemy'
import type { GameEvent } from '@/game/world/events'
import { IDLE_PLAYER_INPUT, type PlayerInput, type World } from '@/game/world/state'
import { createWorld, stepWorld } from '@/game/world/world'

// These tests are about projectile rules, so targets are inert: Shooters
// that cannot move, turn or fire, and no spawns.
const config: GameConfig = structuredClone(DEFAULT_GAME_CONFIG)
config.shooter = { ...config.shooter, maxSpeed: 0, acceleration: 0, turnSpeed: 0, attackRange: 0 }
config.spawn.intervalSeconds = Number.POSITIVE_INFINITY

const DT = config.simulation.stepSeconds
const { frontWeapon, broadside } = config.player

/** Runs `steps` steps with the given input held, returning every event. */
function hold(world: World, input: Partial<PlayerInput>, steps = 1): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < steps; i++) {
    stepWorld(world, { player: { ...IDLE_PLAYER_INPUT, ...input } }, DT)
    events.push(...world.events)
  }
  return events
}

const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type)

function addEnemy(world: World, position: Vec2, health?: number) {
  const enemy = world.enemies.add((id) => createEnemy(id, 'shooter', config, position, 0))
  if (health !== undefined) enemy.health = health
  return enemy
}

// The player starts at (800, 448) with the bow pointing up (-y).
const newWorld = () => createWorld(config, 1)

describe('front cannon', () => {
  it('fires one projectile along the heading, from the bow', () => {
    const world = newWorld()

    const shots = ofType(hold(world, { fireFront: true }), 'shot')

    expect(shots).toHaveLength(1)
    expect(shots[0]?.weapon).toBe('front')
    const [projectile] = [...world.projectiles]
    expect(projectile?.velocity.x).toBeCloseTo(0, 9)
    expect(projectile?.velocity.y).toBeCloseTo(-frontWeapon.projectileSpeed, 9)
    expect(projectile?.position.y).toBeLessThan(world.player.position.y - world.player.radius)
  })

  it('repeats only at its cooldown while held', () => {
    const world = newWorld()

    // 1 s held: fires at 0, 0.35 and 0.70 s.
    const shots = ofType(hold(world, { fireFront: true }, 60), 'shot')

    expect(shots).toHaveLength(3)
  })
})

describe('broadsides', () => {
  it('fire three parallel projectiles to the port side', () => {
    const world = newWorld()

    hold(world, { fireLeft: true })

    const projectiles = [...world.projectiles]
    expect(projectiles).toHaveLength(broadside.projectileCount)
    for (const p of projectiles) {
      expect(p.velocity.x).toBeCloseTo(-broadside.projectileSpeed, 9)
      expect(p.velocity.y).toBeCloseTo(0, 9)
    }
    const ys = projectiles.map((p) => p.position.y - world.player.position.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(-broadside.spacing, 6)
    expect(ys[1]).toBeCloseTo(0, 6)
    expect(ys[2]).toBeCloseTo(broadside.spacing, 6)
  })

  it('fire to the starboard side', () => {
    const world = newWorld()

    hold(world, { fireRight: true })

    for (const p of world.projectiles) expect(p.velocity.x).toBeCloseTo(broadside.projectileSpeed, 9)
  })

  it('keep a cooldown independent from each other and from the front cannon', () => {
    const world = newWorld()

    const first = ofType(hold(world, { fireFront: true, fireLeft: true, fireRight: true }), 'shot')
    const second = ofType(hold(world, { fireFront: true, fireLeft: true, fireRight: true }), 'shot')

    expect(first.map((s) => s.weapon).sort()).toEqual(['front', 'left', 'right'])
    expect(second).toHaveLength(0)
    expect(world.projectiles.size).toBe(1 + 2 * broadside.projectileCount)
  })

  it('cannot fire once the player is sunk', () => {
    const world = newWorld()
    world.player.health = 0

    expect(ofType(hold(world, { fireFront: true, fireLeft: true }), 'shot')).toHaveLength(0)
  })
})

describe('projectiles', () => {
  it('fall into the sea when their lifetime ends', () => {
    const world = newWorld()

    // Starboard (east) from the spawn: open water for the whole range.
    const events = hold(world, { fireRight: true }, Math.ceil(broadside.projectileLifetimeSeconds / DT) + 1)

    expect(world.projectiles.size).toBe(0)
    const splashes = ofType(events, 'splash')
    expect(splashes).toHaveLength(broadside.projectileCount)
    expect(splashes.every((s) => !s.onLand)).toBe(true)
  })

  it('stop at an island', () => {
    const world = newWorld()
    // West of the top-left island (x 192-448, y 128-256), bow up: port fire heads west into it.
    world.player.position = { x: 600, y: 192 }

    const events = hold(world, { fireLeft: true }, 60)

    const splashes = ofType(events, 'splash')
    expect(splashes).toHaveLength(broadside.projectileCount)
    expect(splashes.every((s) => s.onLand && s.position.x > 440)).toBe(true)
    expect(world.projectiles.size).toBe(0)
  })

  it('are removed when they leave the arena', () => {
    const world = newWorld()

    // Straight up from y = 448: 460 units/s leaves the arena before the 1.1 s lifetime.
    const events = hold(world, { fireFront: true }, 1)
    events.push(...hold(world, {}, 66))

    expect(world.projectiles.size).toBe(0)
    expect(ofType(events, 'splash')).toHaveLength(0)
  })

  it('damage an enemy once and disappear', () => {
    const world = newWorld()
    const enemy = addEnemy(world, { x: 800, y: 300 })

    const events = hold(world, { fireFront: true }, 1)
    events.push(...hold(world, {}, 60))

    expect(enemy.health).toBe(config.shooter.maxHealth - frontWeapon.damage)
    expect(ofType(events, 'hit')).toHaveLength(1)
    expect(world.projectiles.size).toBe(0)
    expect(world.player.health).toBe(config.player.maxHealth)
  })

  it('damage only one of two overlapping enemies', () => {
    const world = newWorld()
    const a = addEnemy(world, { x: 800, y: 300 })
    const b = addEnemy(world, { x: 800, y: 300 })

    hold(world, { fireFront: true }, 1)
    hold(world, {}, 30)

    const lost = 2 * config.shooter.maxHealth - a.health - b.health
    expect(lost).toBe(frontWeapon.damage)
  })

  it('destroy an enemy at zero health, crediting the player, and stop hitting it', () => {
    const world = newWorld()
    // All three starboard projectiles overlap this enemy on the same step.
    const enemy = addEnemy(world, { x: 900, y: 448 }, broadside.damage)

    const events = hold(world, { fireRight: true }, 20)

    expect(ofType(events, 'hit')).toHaveLength(1)
    const destroyed = ofType(events, 'destroyed')
    expect(destroyed).toHaveLength(1)
    expect(destroyed[0]).toMatchObject({ shipId: enemy.id, kind: 'shooter', cause: 'player-fire' })
    expect(world.enemies.size).toBe(0)
  })

  it('from enemies hit the player and never other enemies', () => {
    const world = newWorld()
    const enemy = addEnemy(world, { x: 500, y: 600 })
    const shot = (position: Vec2) =>
      world.projectiles.add((id) => ({
        id,
        side: 'enemy',
        position,
        velocity: { x: 0, y: 0 },
        damage: 10,
        radius: 6,
        lifetime: 1,
      }))
    shot({ ...enemy.position })
    shot({ ...world.player.position })

    hold(world, {})

    expect(enemy.health).toBe(config.shooter.maxHealth)
    expect(world.player.health).toBe(config.player.maxHealth - 10)
    expect(world.projectiles.size).toBe(1)
  })
})
