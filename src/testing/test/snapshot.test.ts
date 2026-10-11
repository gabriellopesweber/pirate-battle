import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { Match } from '@/game/match/match'
import { IDLE_PLAYER_INPUT } from '@/game/world/state'
import { snapshotMatch } from '@/testing/snapshot'

const DT = DEFAULT_GAME_CONFIG.simulation.stepSeconds

function stepFor(match: Match, seconds: number, input = IDLE_PLAYER_INPUT) {
  for (let i = 0; i < Math.round(seconds / DT); i++) match.step(input, DT)
}

describe('snapshotMatch', () => {
  it('describes the match and the player at the start', () => {
    const match = new Match(DEFAULT_GAME_CONFIG, 7)

    const snapshot = snapshotMatch(match)

    expect(snapshot).toMatchObject({
      status: 'running',
      score: 0,
      seed: 7,
      timeLeft: DEFAULT_GAME_CONFIG.match.durationSeconds,
      spawned: 0,
      enemies: [],
      projectiles: [],
      result: null,
    })
    expect(snapshot.player).toMatchObject({
      health: snapshot.player.maxHealth,
      speed: 0,
      onLand: false,
    })
    expect(snapshot.arena.width).toBeGreaterThan(0)
    expect(snapshot.arena.islands).toHaveLength(DEFAULT_GAME_CONFIG.arena.islands.length)
    expect(snapshot.player.radius).toBeGreaterThan(0)
  })

  it('lists the enemies as they spawn, with their kind', () => {
    const match = new Match(DEFAULT_GAME_CONFIG, 7)

    stepFor(match, DEFAULT_GAME_CONFIG.spawn.intervalSeconds * 2 + 0.1)

    const { enemies, spawned } = snapshotMatch(match)
    expect(spawned).toBe(2)
    expect(enemies.map((enemy) => enemy.kind).sort()).toEqual(['chaser', 'shooter'])
  })

  it("lists the player's shots with their side", () => {
    const match = new Match(DEFAULT_GAME_CONFIG, 7)

    stepFor(match, DT, { ...IDLE_PLAYER_INPUT, fireFront: true })

    const { projectiles, weapons } = snapshotMatch(match)
    expect(projectiles.map((projectile) => projectile.side)).toEqual(['player'])
    expect(weapons.front).toBeGreaterThan(0)
    expect(weapons.left).toBe(0)
  })

  it('is plain data that survives JSON, as a browser test receives it', () => {
    const match = new Match(DEFAULT_GAME_CONFIG, 7)
    stepFor(match, 3.5)
    const snapshot = snapshotMatch(match)

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('is a copy: changing it never touches the match', () => {
    const match = new Match(DEFAULT_GAME_CONFIG, 7)
    const snapshot = snapshotMatch(match)

    snapshot.player.position.x = -999

    expect(match.world.player.position.x).not.toBe(-999)
  })
})
