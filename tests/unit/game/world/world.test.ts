import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { circleHitsLand } from '@/game/world/arena'
import { createWorld, stepWorld } from '@/game/world/world'

describe('world', () => {
  it('starts the player at the configured spawn with full health', () => {
    const world = createWorld(DEFAULT_GAME_CONFIG, 1)

    expect(world.player.position).toEqual(DEFAULT_GAME_CONFIG.arena.playerSpawn)
    expect(world.player.health).toBe(DEFAULT_GAME_CONFIG.player.maxHealth)
    expect(world.time).toBe(0)
  })

  it('refuses a player spawn on land', () => {
    const config = structuredClone(DEFAULT_GAME_CONFIG)
    config.arena.playerSpawn = { x: 3 * 64 + 32, y: 2 * 64 + 32 }

    expect(() => createWorld(config, 1)).toThrow()
  })

  it('keeps the player in water across a long, erratic sail in the default arena', () => {
    const world = createWorld(DEFAULT_GAME_CONFIG, 1)
    const dt = DEFAULT_GAME_CONFIG.simulation.stepSeconds

    for (let i = 0; i < 60 * 60; i++) {
      const turn = ([-1, 0, 1] as const)[Math.floor(i / 90) % 3] ?? 0
      stepWorld(world, { player: { thrust: true, turn } }, dt)
      expect(circleHitsLand(world.arena, world.player.position, world.player.radius)).toBe(false)
    }

    expect(world.time).toBeCloseTo(60, 6)
  })
})
