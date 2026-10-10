import { angleTo, distanceSq, type Vec2 } from '@/game/core/vector'
import { createEnemy, type EnemyKind } from '@/game/entities/enemy'
import { circleIsClear } from '@/game/world/arena'
import type { World } from '@/game/world/state'

// Random candidates tried per spawn before giving up until the next interval.
const ATTEMPTS = 40
// The first spawns cycle through these kinds, so both enemy types appear in
// every match regardless of the random weights; later spawns are weighted.
const OPENING: readonly EnemyKind[] = ['chaser', 'shooter']

/**
 * Spawns one enemy every `spawn.intervalSeconds` while the alive count is
 * below the cap. A spawn point must be open water clear of land, the arena
 * edge and other enemies, and far enough from the player that no damage is
 * unavoidable. When no such point turns up, the spawn is skipped — the
 * cadence is never shortened to make up for it.
 */
export function updateSpawner(world: World, dt: number): void {
  const { spawn } = world.config
  world.spawner.timer -= dt
  if (world.spawner.timer > 0) return
  world.spawner.timer += spawn.intervalSeconds

  if (world.enemies.size >= spawn.maxAliveEnemies) return

  const kind = OPENING[world.spawner.count] ?? world.rng.weighted(spawn.weights)
  const radius = kind === 'chaser' ? world.config.chaser.radius : world.config.shooter.radius
  const position = findSpawnPoint(world, radius)
  if (!position) return

  world.enemies.add((id) => createEnemy(id, kind, world.config, position, angleTo(position, world.player.position)))
  world.spawner.count++
}

export function findSpawnPoint(world: World, radius: number): Vec2 | undefined {
  const { arena, rng, player } = world
  const { clearance, minDistanceFromPlayer } = world.config.spawn
  const margin = radius + clearance

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const candidate = {
      x: rng.range(margin, arena.width - margin),
      y: rng.range(margin, arena.height - margin),
    }
    if (!circleIsClear(arena, candidate, margin)) continue
    if (distanceSq(candidate, player.position) < minDistanceFromPlayer ** 2) continue
    let crowded = false
    for (const enemy of world.enemies) {
      if (distanceSq(candidate, enemy.position) < (radius + enemy.radius + clearance) ** 2) crowded = true
    }
    if (!crowded) return candidate
  }
  return undefined
}
