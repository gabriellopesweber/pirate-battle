import { angleTo, distance, wrapAngle } from '@/game/core/vector'
import type { Enemy } from '@/game/entities/enemy'
import type { ShipControls } from '@/game/entities/ship'
import { tickCooldown } from '@/game/systems/cooldown'
import { moveShip } from '@/game/systems/movement'
import { fireVolley } from '@/game/systems/weapons'
import { circleHitsLand } from '@/game/world/arena'
import type { World } from '@/game/world/state'

// Below this heading error the ship holds its course instead of jittering
// left and right around the target direction.
const AIM_TOLERANCE = 0.05
// How far ahead an enemy looks for land, and the angle of its side probes.
const LOOKAHEAD = 90
const PROBE_ANGLE = 0.6
// How long a detour is held before steering is re-evaluated.
const DETOUR_SECONDS = 0.5

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
    moveShip(enemy, steer(world, enemy, dt), stats, world.arena, dt)

    if (enemy.kind === 'shooter' && player.health > 0) {
      const { weapon, attackRange } = world.config.shooter
      if (distance(enemy.position, player.position) <= attackRange) {
        fireVolley(world, enemy, 'enemy', 'shooter', weapon, enemy.weapon, angleTo(enemy.position, player.position))
      }
    }
  }
}

/**
 * Pursuit with land avoidance.
 *
 * The enemy turns towards the player. When the way it wants to go — straight
 * ahead, or the side it wants to turn to — has land within `LOOKAHEAD`, it
 * picks the clear side and **commits** to that turn for `DETOUR_SECONDS`.
 * Without the commitment, pursuit and avoidance alternate every step and the
 * ship ends up pinned against the coast, nudging back and forth. A local
 * rule, not pathfinding: an enemy can lose time behind an island, but it
 * keeps moving around it.
 */
function steer(world: World, enemy: Enemy, dt: number): ShipControls {
  const { player } = world
  const thrust = enemy.kind === 'chaser' || distance(enemy.position, player.position) > world.config.shooter.preferredDistance

  if (enemy.detour.seconds > 0) {
    enemy.detour.seconds -= dt
    return { thrust: true, turn: enemy.detour.turn }
  }

  const error = wrapAngle(angleTo(enemy.position, player.position) - enemy.heading)
  const wanted: -1 | 0 | 1 = Math.abs(error) < AIM_TOLERANCE ? 0 : error > 0 ? 1 : -1

  const blocked = (angle: number) =>
    circleHitsLand(
      world.arena,
      {
        x: enemy.position.x + Math.cos(enemy.heading + angle) * LOOKAHEAD,
        y: enemy.position.y + Math.sin(enemy.heading + angle) * LOOKAHEAD,
      },
      enemy.radius,
    )
  const aheadBlocked = blocked(0)
  const wantedSideBlocked = wanted !== 0 && blocked(wanted * PROBE_ANGLE)
  if (!aheadBlocked && !wantedSideBlocked) return { thrust, turn: wanted }

  const leftClear = !blocked(-PROBE_ANGLE)
  const rightClear = !blocked(PROBE_ANGLE)
  let turn: -1 | 1
  if (leftClear !== rightClear) turn = leftClear ? -1 : 1
  else if (wanted !== 0 && !wantedSideBlocked) turn = wanted
  else turn = wanted === 1 ? -1 : 1
  enemy.detour.turn = turn
  enemy.detour.seconds = DETOUR_SECONDS
  return { thrust: true, turn }
}
