import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import { distance } from '@/game/core/vector'
import type { Enemy } from '@/game/entities/enemy'
import { circleIsClear } from '@/game/world/arena'
import { IDLE_PLAYER_INPUT, type World } from '@/game/world/state'
import { createWorld, stepWorld } from '@/game/world/world'

const DT = DEFAULT_GAME_CONFIG.simulation.stepSeconds

/** Steps the world and reports each enemy the moment it spawns. */
function run(world: World, steps: number, onSpawn?: (enemy: Enemy) => void) {
  const seen = new Set<number>()
  for (let i = 0; i < steps; i++) {
    stepWorld(world, { player: IDLE_PLAYER_INPUT }, DT)
    for (const enemy of world.enemies) {
      if (!seen.has(enemy.id)) {
        seen.add(enemy.id)
        onSpawn?.(enemy)
      }
    }
  }
}

describe('spawner', () => {
  it('spawns at the configured interval', () => {
    const world = createWorld(DEFAULT_GAME_CONFIG, 1)
    const interval = DEFAULT_GAME_CONFIG.spawn.intervalSeconds

    run(world, Math.round(interval / DT) - 5)
    expect(world.spawner.count).toBe(0)
    run(world, 10)
    expect(world.spawner.count).toBe(1)
  })

  it('opens with one Chaser and one Shooter, so both appear in every match', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const kinds: string[] = []
      run(createWorld(DEFAULT_GAME_CONFIG, seed), Math.round(6.5 / DT), (enemy) => kinds.push(enemy.kind))
      expect(kinds.slice(0, 2)).toEqual(['chaser', 'shooter'])
    }
  })

  it('never exceeds the alive-enemy cap', () => {
    const config: GameConfig = structuredClone(DEFAULT_GAME_CONFIG)
    config.spawn.intervalSeconds = 0.1
    config.spawn.maxAliveEnemies = 3
    // Keep the Chasers from ramming and freeing slots.
    config.chaser.maxSpeed = 0
    const world = createWorld(config, 1)

    for (let i = 0; i < 120; i++) {
      run(world, 1)
      expect(world.enemies.size).toBeLessThanOrEqual(3)
    }
    expect(world.enemies.size).toBe(3)
  })

  it('only spawns in open water, far from the player and from other enemies', () => {
    const { spawn } = DEFAULT_GAME_CONFIG
    for (let seed = 1; seed <= 30; seed++) {
      const world = createWorld(DEFAULT_GAME_CONFIG, seed)
      run(world, Math.round(30 / DT), (enemy) => {
        expect(circleIsClear(world.arena, enemy.position, enemy.radius + spawn.clearance)).toBe(true)
        expect(distance(enemy.position, world.player.position)).toBeGreaterThanOrEqual(spawn.minDistanceFromPlayer)
        for (const other of world.enemies) {
          if (other.id !== enemy.id) {
            expect(distance(enemy.position, other.position)).toBeGreaterThanOrEqual(enemy.radius + other.radius)
          }
        }
      })
    }
  })

  it('is reproducible from the seed', () => {
    const positions = (seed: number) => {
      const list: string[] = []
      run(createWorld(DEFAULT_GAME_CONFIG, seed), Math.round(20 / DT), (e) => {
        list.push(`${e.kind}@${e.position.x.toFixed(3)},${e.position.y.toFixed(3)}`)
      })
      return list
    }

    expect(positions(7)).toEqual(positions(7))
    expect(positions(7)).not.toEqual(positions(8))
  })
})
