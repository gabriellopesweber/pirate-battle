import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import { angleTo, type Vec2 } from '@/game/core/vector'
import { createEnemy, type EnemyKind } from '@/game/entities/enemy'
import { Match } from '@/game/match/match'
import { IDLE_PLAYER_INPUT, type PlayerInput } from '@/game/world/state'

const DT = DEFAULT_GAME_CONFIG.simulation.stepSeconds

// The player starts at (800, 448) with the bow up. Enemies are placed by
// hand; the spawner stays off unless a test turns it on.
function testConfig(edit?: (config: GameConfig) => void): GameConfig {
  const config = structuredClone(DEFAULT_GAME_CONFIG)
  config.match.durationSeconds = 60
  config.spawn.intervalSeconds = Number.POSITIVE_INFINITY
  edit?.(config)
  return config
}

function steps(match: Match, count: number, input: Partial<PlayerInput> = {}) {
  for (let i = 0; i < count; i++) match.step({ ...IDLE_PLAYER_INPUT, ...input }, DT)
}

function place(match: Match, kind: EnemyKind, position: Vec2) {
  const { world } = match
  return world.enemies.add((id) =>
    createEnemy(id, kind, world.config, position, angleTo(position, world.player.position)),
  )
}

// Shooters that cannot move or fire: plain targets.
const inertShooters = (c: GameConfig) => {
  c.shooter = { ...c.shooter, maxSpeed: 0, acceleration: 0, turnSpeed: 0, attackRange: 0 }
}

describe('Match clock', () => {
  it('runs for exactly the configured duration, then ends by time', () => {
    const match = new Match(testConfig(), 1)

    steps(match, 60 * 60 - 1)
    expect(match.status).toBe('running')
    expect(match.timeLeftSeconds).toBeCloseTo(DT, 9)

    steps(match, 1)
    expect(match.status).toBe('ended')
    expect(match.result).toMatchObject({ reason: 'time-up', score: 0, durationSeconds: 60, seed: 1 })
  })
})

describe('Match score', () => {
  it('scores one point per enemy destroyed by the player', () => {
    const match = new Match(testConfig(inertShooters), 1)
    const target = place(match, 'shooter', { x: 800, y: 250 })
    target.health = 1
    place(match, 'shooter', { x: 800, y: 150 }).health = 1

    steps(match, 90, { fireFront: true })

    expect(match.score).toBe(2)
  })

  it('does not score a Chaser exploding against the player', () => {
    const match = new Match(testConfig(), 1)
    place(match, 'chaser', { x: 1100, y: 448 })

    steps(match, 5 * 60)

    expect(match.world.enemies.size).toBe(0)
    expect(match.world.player.health).toBeLessThan(DEFAULT_GAME_CONFIG.player.maxHealth)
    expect(match.score).toBe(0)
  })
})

describe('Match end', () => {
  it('ends when the player sinks, recording the time actually played', () => {
    const match = new Match(testConfig(), 1)
    match.world.player.health = 10
    place(match, 'chaser', { x: 1100, y: 448 })

    steps(match, 5 * 60)

    expect(match.status).toBe('ended')
    expect(match.result?.reason).toBe('destroyed')
    expect(match.result?.durationSeconds).toBeLessThan(5)
    expect(match.result?.durationSeconds).toBeCloseTo(match.world.time, 3)
  })

  it('stops movement, attacks, damage, spawns and scoring once ended', () => {
    const match = new Match(
      testConfig((c) => {
        c.spawn.intervalSeconds = 0.5
      }),
      1,
    )
    match.world.player.health = 1
    place(match, 'chaser', { x: 900, y: 448 })
    steps(match, 2 * 60)
    expect(match.status).toBe('ended')

    const { world } = match
    const frozen = {
      time: world.time,
      position: { ...world.player.position },
      enemies: world.enemies.size,
      projectiles: world.projectiles.size,
      spawned: world.spawner.count,
      score: match.score,
    }
    steps(match, 3 * 60, { thrust: true, turn: 1, fireFront: true, fireLeft: true })

    expect({
      time: world.time,
      position: world.player.position,
      enemies: world.enemies.size,
      projectiles: world.projectiles.size,
      spawned: world.spawner.count,
      score: match.score,
    }).toEqual(frozen)
  })
})

describe('Match pause', () => {
  it('freezes the clock, cooldowns, movement and spawns until resumed', () => {
    const match = new Match(
      testConfig((c) => {
        c.spawn.intervalSeconds = 2
      }),
      1,
    )
    steps(match, 30, { thrust: true, fireFront: true })
    match.pause('manual')

    const { world } = match
    const before = {
      time: world.time,
      position: { ...world.player.position },
      cooldown: world.playerWeapons.front.remaining,
      spawnTimer: world.spawner.timer,
    }
    steps(match, 10 * 60, { thrust: true, fireFront: true })

    expect({
      time: world.time,
      position: world.player.position,
      cooldown: world.playerWeapons.front.remaining,
      spawnTimer: world.spawner.timer,
    }).toEqual(before)
    expect(match.status).toBe('paused')

    match.resume()
    steps(match, 1, { thrust: true })
    expect(world.time).toBeCloseTo(before.time + DT, 9)
  })

  it('keeps a manual pause when focus is lost afterwards', () => {
    const match = new Match(testConfig(), 1)

    match.pause('manual')
    match.pause('focus-lost')

    expect(match.pauseReason).toBe('manual')
  })

  it('cannot pause or resume an ended match', () => {
    const match = new Match(testConfig(), 1)
    match.world.player.health = 1
    place(match, 'chaser', { x: 900, y: 448 })
    steps(match, 2 * 60)

    match.pause('manual')
    match.resume()

    expect(match.status).toBe('ended')
  })
})

describe('restart', () => {
  it('a new match starts from a clean state', () => {
    const first = new Match(testConfig(inertShooters), 1)
    place(first, 'shooter', { x: 800, y: 250 }).health = 1
    steps(first, 90, { fireFront: true, thrust: true })
    expect(first.score).toBe(1)

    const second = new Match(testConfig(inertShooters), 2)

    expect(second.score).toBe(0)
    expect(second.status).toBe('running')
    expect(second.world.time).toBe(0)
    expect(second.world.player.health).toBe(DEFAULT_GAME_CONFIG.player.maxHealth)
    expect(second.world.player.position).toEqual(DEFAULT_GAME_CONFIG.arena.playerSpawn)
    expect(second.world.enemies.size).toBe(0)
    expect(second.world.projectiles.size).toBe(0)
  })
})
