import { angleTo, distance, type Vec2, wrapAngle } from '@/game/core/vector'
import type { Enemy } from '@/game/entities/enemy'
import type { ShipControls } from '@/game/entities/ship'
import { tickCooldown } from '@/game/systems/cooldown'
import { moveShip } from '@/game/systems/movement'
import { fireVolley } from '@/game/systems/weapons'
import { type Arena, circleHitsLand } from '@/game/world/arena'
import type { World } from '@/game/world/state'

// Below this heading error the ship holds its course instead of jittering
// left and right around the target direction.
const AIM_TOLERANCE = 0.05
// Spacing of the samples along a line of sight — under a ship's radius
// (20+) and well under a tile (64), so no land slips between samples.
const SIGHT_STEP = 24
// How far beyond its own radius a ship rounds an island corner.
const CORNER_MARGIN = 20
// Added to the cost of a corner that has no view of the goal.
const BLIND_CORNER_PENALTY = 10_000

/**
 * Steers, moves and fires every enemy for one step.
 *
 * AI only produces `ShipControls` — enemies move through the same
 * `moveShip` as the player, so they obey the same physics and the same
 * island collisions.
 */
export function updateEnemies(world: World, dt: number): void {
  const { player } = world
  for (const enemy of world.enemies) {
    tickCooldown(enemy.weapon, dt)
    const stats = enemy.kind === 'chaser' ? world.config.chaser : world.config.shooter
    moveShip(enemy, steer(world, enemy), stats, world.arena, dt)

    if (enemy.kind === 'shooter' && player.health > 0) {
      const { weapon, attackRange } = world.config.shooter
      if (distance(enemy.position, player.position) <= attackRange) {
        fireVolley(world, enemy, 'enemy', 'shooter', weapon, enemy.weapon, angleTo(enemy.position, player.position))
      }
    }
  }
}

function steer(world: World, enemy: Enemy): ShipControls {
  const { player } = world
  const thrust =
    enemy.kind === 'chaser' || distance(enemy.position, player.position) > world.config.shooter.preferredDistance
  const target = waypoint(world.arena, enemy, player.position)
  const error = wrapAngle(angleTo(enemy.position, target) - enemy.heading)
  const turn = Math.abs(error) < AIM_TOLERANCE ? 0 : error > 0 ? 1 : -1
  return { thrust, turn }
}

/**
 * Where to head for: the player, or — when land hides the player — the
 * corner of an island that opens the shortest way round.
 *
 * Every island is a convex block. Of the island corners — pushed out by the
 * ship's radius plus a margin — the ship picks one it can see that minimises
 * (ship → corner → player), preferring corners that see the player. It is
 * re-picked every step, so a ship straight behind an island heads for a near
 * corner, then the far corner comes into view and it chains on; once the
 * player is in sight, pursuit resumes. A one-hop visibility graph re-run each
 * step — stateless, so nothing can get stuck in a mode.
 *
 * Two simpler rules were tried first and dropped: "turn away from land ahead
 * for a moment" pinned ships against coasts or sent them circling below an
 * island, because pursuit kept pulling them back into it.
 */
export function waypoint(arena: Arena, enemy: Enemy, goal: Vec2): Vec2 {
  if (hasLineOfSight(arena, enemy.position, goal, enemy.radius)) return goal

  const margin = enemy.radius + CORNER_MARGIN
  let best: Vec2 | undefined
  let bestCost = Number.POSITIVE_INFINITY
  for (const island of arena.islands) {
    const corners = [
      { x: island.left - margin, y: island.top - margin },
      { x: island.right + margin, y: island.top - margin },
      { x: island.left - margin, y: island.bottom + margin },
      { x: island.right + margin, y: island.bottom + margin },
    ]
    for (const corner of corners) {
      if (corner.x < enemy.radius || corner.y < enemy.radius) continue
      if (corner.x > arena.width - enemy.radius || corner.y > arena.height - enemy.radius) continue
      if (!hasLineOfSight(arena, enemy.position, corner, enemy.radius)) continue
      // A corner that does not see the goal would leave the ship there,
      // still blind: only use one when nothing better exists.
      const blind = hasLineOfSight(arena, corner, goal, enemy.radius) ? 0 : BLIND_CORNER_PENALTY
      const cost = distance(enemy.position, corner) + distance(corner, goal) + blind
      if (cost < bestCost) {
        best = corner
        bestCost = cost
      }
    }
  }
  return best ?? goal
}

/** True when a ship of `radius` could sail straight from `from` to `to` without touching land. */
export function hasLineOfSight(arena: Arena, from: Vec2, to: Vec2, radius: number): boolean {
  const samples = Math.ceil(distance(from, to) / SIGHT_STEP)
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    if (circleHitsLand(arena, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, radius)) {
      return false
    }
  }
  return true
}
