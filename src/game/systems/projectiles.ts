import { distanceSq } from '@/game/core/vector'
import type { Projectile } from '@/game/entities/projectile'
import type { Ship } from '@/game/entities/ship'
import { damageShip } from '@/game/systems/combat'
import { circleHitsLand } from '@/game/world/arena'
import type { World } from '@/game/world/state'

/**
 * Moves every projectile one step and resolves what it touches, in order:
 * a ship of the other side, land, the arena edge, then expiry.
 *
 * A projectile damages at most one ship and is removed in the same step, so
 * it can never apply damage twice. At under 8 units per step against ships
 * of 20+ units radius, a projectile cannot skip over a target.
 */
export function updateProjectiles(world: World, dt: number): void {
  for (const projectile of world.projectiles) {
    projectile.position.x += projectile.velocity.x * dt
    projectile.position.y += projectile.velocity.y * dt
    projectile.lifetime -= dt

    const target = findTarget(world, projectile)
    if (target) {
      damageShip(world, target, projectile.damage, projectile.side === 'player' ? 'player-fire' : 'enemy-fire')
      world.projectiles.remove(projectile.id)
      continue
    }

    const { x, y } = projectile.position
    const outside = x < 0 || y < 0 || x > world.arena.width || y > world.arena.height
    if (outside) {
      world.projectiles.remove(projectile.id)
    } else if (circleHitsLand(world.arena, projectile.position, projectile.radius)) {
      world.events.push({ type: 'splash', position: { ...projectile.position }, onLand: true })
      world.projectiles.remove(projectile.id)
    } else if (projectile.lifetime <= 0) {
      world.events.push({ type: 'splash', position: { ...projectile.position }, onLand: false })
      world.projectiles.remove(projectile.id)
    }
  }
}

function findTarget(world: World, projectile: Projectile): Ship | undefined {
  if (projectile.side === 'enemy') {
    return overlaps(projectile, world.player) && world.player.health > 0 ? world.player : undefined
  }
  for (const enemy of world.enemies) {
    if (overlaps(projectile, enemy)) return enemy
  }
  return undefined
}

const overlaps = (projectile: Projectile, ship: Ship): boolean =>
  distanceSq(projectile.position, ship.position) < (projectile.radius + ship.radius) ** 2
