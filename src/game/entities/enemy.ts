import type { GameConfig } from '@/game/config/gameConfig'
import type { EntityId } from '@/game/core/entityStore'
import type { Vec2 } from '@/game/core/vector'
import { createShip, type Ship } from '@/game/entities/ship'
import { type Cooldown, readyCooldown } from '@/game/systems/cooldown'

export type EnemyKind = 'chaser' | 'shooter'

export interface Enemy extends Ship {
  readonly kind: EnemyKind
  /** Only the Shooter fires; the Chaser's cooldown is never used. */
  readonly weapon: Cooldown
}

export function createEnemy(
  id: EntityId,
  kind: EnemyKind,
  config: Readonly<GameConfig>,
  position: Vec2,
  heading: number,
): Enemy {
  const stats = kind === 'chaser' ? config.chaser : config.shooter
  return {
    ...createShip(id, kind, stats, position, heading),
    kind,
    weapon: readyCooldown(),
  }
}
