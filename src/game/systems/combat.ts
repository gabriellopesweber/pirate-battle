import { distanceSq } from '@/game/core/vector'
import type { Ship } from '@/game/entities/ship'
import type { DestroyCause } from '@/game/world/events'
import type { World } from '@/game/world/state'

/**
 * Applies damage to a ship and destroys it at zero health.
 * Damage to a ship that is already destroyed is ignored.
 */
export function damageShip(world: World, ship: Ship, damage: number, cause: DestroyCause): void {
  if (ship.health <= 0) return
  ship.health = Math.max(0, ship.health - damage)
  world.events.push({ type: 'hit', targetId: ship.id, position: { ...ship.position }, damage })
  if (ship.health <= 0) destroyShip(world, ship, cause)
}

/**
 * Sinks a ship. A destroyed enemy leaves its store immediately (deferred
 * removal hides it for the rest of the step), so it stops colliding, firing
 * and taking hits at once.
 */
export function destroyShip(world: World, ship: Ship, cause: DestroyCause): void {
  ship.health = 0
  world.events.push({ type: 'destroyed', shipId: ship.id, kind: ship.kind, position: { ...ship.position }, cause })
  if (ship.kind !== 'player') world.enemies.remove(ship.id)
}

/**
 * A Chaser touching the player damages it and explodes. The explosion is a
 * `ram`, not a kill by the player, so it scores nothing.
 */
export function resolveRams(world: World): void {
  const { player } = world
  if (player.health <= 0) return
  for (const enemy of world.enemies) {
    if (enemy.kind !== 'chaser') continue
    if (distanceSq(enemy.position, player.position) >= (enemy.radius + player.radius) ** 2) continue
    destroyShip(world, enemy, 'ram')
    damageShip(world, player, world.config.chaser.contactDamage, 'ram')
    if (player.health <= 0) return
  }
}
