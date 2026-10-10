import type { Ship } from '@/game/entities/ship'
import type { DestroyCause } from '@/game/world/events'
import type { World } from '@/game/world/state'

/**
 * Applies damage to a ship and destroys it at zero health.
 *
 * A destroyed enemy leaves its store immediately (deferred removal hides it
 * from the rest of the step), so it stops colliding, firing and taking hits.
 * Damage to a ship that is already destroyed is ignored.
 */
export function damageShip(world: World, ship: Ship, damage: number, cause: DestroyCause): void {
  if (ship.health <= 0) return
  ship.health = Math.max(0, ship.health - damage)
  world.events.push({ type: 'hit', targetId: ship.id, position: { ...ship.position }, damage })
  if (ship.health > 0) return

  world.events.push({ type: 'destroyed', shipId: ship.id, kind: ship.kind, position: { ...ship.position }, cause })
  if (ship.kind !== 'player') world.enemies.remove(ship.id)
}
