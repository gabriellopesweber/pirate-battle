import type { WeaponStats } from '@/game/config/gameConfig'
import type { Side } from '@/game/entities/projectile'
import type { Ship } from '@/game/entities/ship'
import { type Cooldown, isReady } from '@/game/systems/cooldown'
import type { WeaponKind } from '@/game/world/events'
import type { World } from '@/game/world/state'

/**
 * Fires a volley if the weapon is ready and restarts its cooldown.
 * Returns whether it fired.
 *
 * `direction` is the flight angle. `offsets` places each projectile along the
 * ship's length (for broadsides) — every projectile flies parallel.
 */
export function fireVolley(
  world: World,
  ship: Ship,
  side: Side,
  weapon: WeaponKind,
  stats: WeaponStats,
  cooldown: Cooldown,
  direction: number,
  offsets: readonly number[] = [0],
): boolean {
  if (!isReady(cooldown)) return false
  cooldown.remaining = stats.cooldownSeconds

  const alongX = Math.cos(ship.heading)
  const alongY = Math.sin(ship.heading)
  const outX = Math.cos(direction)
  const outY = Math.sin(direction)
  // Start just clear of the hull, so a ship never hits itself.
  const muzzle = ship.radius + stats.projectileRadius + 1

  for (const offset of offsets) {
    const position = {
      x: ship.position.x + outX * muzzle + alongX * offset,
      y: ship.position.y + outY * muzzle + alongY * offset,
    }
    world.projectiles.add((id) => ({
      id,
      side,
      position,
      velocity: { x: outX * stats.projectileSpeed, y: outY * stats.projectileSpeed },
      damage: stats.damage,
      radius: stats.projectileRadius,
      lifetime: stats.projectileLifetimeSeconds,
    }))
  }

  world.events.push({
    type: 'shot',
    side,
    weapon,
    shipId: ship.id,
    position: { x: ship.position.x + outX * muzzle, y: ship.position.y + outY * muzzle },
    angle: direction,
  })
  return true
}

/** Offsets that space `count` projectiles evenly, centred on the ship. */
export function broadsideOffsets(count: number, spacing: number): number[] {
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing)
}
