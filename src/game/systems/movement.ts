import type { ShipStats } from '@/game/config/gameConfig'
import { wrapAngle } from '@/game/core/vector'
import type { Ship, ShipControls } from '@/game/entities/ship'
import { type Arena, resolveCircleAgainstArena } from '@/game/world/arena'

// A ship that achieved less than this share of its intended travel counts as
// stalled against land. Grazing a coast (e.g. at 45°, ~71% achieved) keeps
// its speed and slides; ramming it nearly head-on stops it.
const STALL_RATIO = 0.25

/**
 * Advances one ship by `dt`: turn, accelerate or coast, move along the
 * heading, then resolve collisions with land and the arena edge.
 *
 * Shared by the player and by enemies — AI only produces `ShipControls`.
 */
export function moveShip(ship: Ship, controls: ShipControls, stats: ShipStats, arena: Arena, dt: number): void {
  ship.heading = wrapAngle(ship.heading + controls.turn * stats.turnSpeed * dt)

  const target = controls.thrust ? stats.maxSpeed : 0
  const change = stats.acceleration * dt
  ship.speed = ship.speed < target ? Math.min(ship.speed + change, target) : Math.max(ship.speed - change, target)

  const startX = ship.position.x
  const startY = ship.position.y
  const intended = ship.speed * dt
  ship.position.x += Math.cos(ship.heading) * intended
  ship.position.y += Math.sin(ship.heading) * intended

  if (resolveCircleAgainstArena(arena, ship.position, ship.radius)) {
    // Only a stall drops the speed. Scaling speed by the achieved share on
    // every collision would compound step after step and glue a ship that
    // merely grazes a coast; it would also let a pinned ship keep full speed
    // and lurch away the moment it turns.
    const moved = Math.hypot(ship.position.x - startX, ship.position.y - startY)
    if (moved < intended * STALL_RATIO) ship.speed = moved / dt
  }
}
