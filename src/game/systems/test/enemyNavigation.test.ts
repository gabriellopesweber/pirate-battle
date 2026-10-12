import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { createRng } from '@/game/core/rng'
import { distance, type Vec2 } from '@/game/core/vector'
import { hasLineOfSight } from '@/game/systems/enemyAi'
import { circleHitsLand } from '@/game/world/arena'
import { IDLE_PLAYER_INPUT } from '@/game/world/state'
import { createWorld, stepWorld } from '@/game/world/world'

// A sweep over whole matches, with real spawning: the player jumps to a new
// spot of open water every few seconds, so every Shooter keeps having islands
// put between itself and its target. No Shooter may sit still for long while
// the player is hidden — that is a ship stuck against a coast (#58).

const SEEDS = 25
const MATCH_SECONDS = 60
const JUMP_EVERY_SECONDS = 8
const STALL_SECONDS = 2
const STALL_DISTANCE = 10

describe('Shooters across many matches', () => {
  it('never sit still against an island while it hides the player', () => {
    const config = structuredClone(DEFAULT_GAME_CONFIG)
    config.spawn.intervalSeconds = 2
    // The player outlives the run, so every Shooter keeps a target to reach.
    config.player.maxHealth = Number.MAX_SAFE_INTEGER
    const dt = config.simulation.stepSeconds
    const stepsPerJump = Math.round(JUMP_EVERY_SECONDS / dt)
    let stalledSeconds = 0

    for (let seed = 1; seed <= SEEDS; seed++) {
      const world = createWorld(config, seed)
      const rng = createRng(seed)
      // Each Shooter's recent positions, over the last STALL_SECONDS.
      const recent = new Map<number, { at: Vec2; time: number }[]>()

      for (let step = 0; step < MATCH_SECONDS / dt; step++) {
        if (step % stepsPerJump === 0) {
          world.player.position = openWater(world.arena, rng)
          // A window across a jump would judge the old position by the new one.
          recent.clear()
        }
        stepWorld(world, { player: IDLE_PLAYER_INPUT }, dt)

        const time = step * dt
        for (const enemy of world.enemies) {
          if (enemy.kind !== 'shooter') continue
          const track = recent.get(enemy.id) ?? []
          track.push({ at: { ...enemy.position }, time })
          while (track.length > 0 && time - (track[0]?.time ?? time) > STALL_SECONDS) track.shift()
          recent.set(enemy.id, track)

          const oldest = track[0]
          if (!oldest || time - oldest.time < STALL_SECONDS - dt) continue
          const hidden = !hasLineOfSight(world.arena, enemy.position, world.player.position, enemy.radius)
          if (hidden && distance(oldest.at, enemy.position) < STALL_DISTANCE) stalledSeconds += dt
        }
      }
    }

    // Before #58 this sweep found 335 s of Shooters parked behind islands.
    expect(stalledSeconds).toBeLessThan(1)
  })
})

function openWater(arena: Parameters<typeof circleHitsLand>[0], rng: ReturnType<typeof createRng>): Vec2 {
  for (;;) {
    const point = { x: rng.range(60, arena.width - 60), y: rng.range(60, arena.height - 60) }
    if (!circleHitsLand(arena, point, 40)) return point
  }
}
