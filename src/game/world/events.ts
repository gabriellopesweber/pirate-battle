import type { EntityId } from '@/game/core/entityStore'
import type { Vec2 } from '@/game/core/vector'
import type { Side } from '@/game/entities/projectile'
import type { ShipKind } from '@/game/entities/ship'

export type WeaponKind = 'front' | 'left' | 'right' | 'shooter'

/**
 * What happened during one simulation step.
 *
 * The renderer turns events into effects and sounds; the match rules turn
 * `destroyed` events into score. Because each kill is one event, it can only
 * be counted once.
 */
export type GameEvent =
  | { type: 'shot'; side: Side; weapon: WeaponKind; shipId: EntityId; position: Vec2; angle: number }
  | { type: 'hit'; targetId: EntityId; position: Vec2; damage: number }
  | { type: 'splash'; position: Vec2; onLand: boolean }
  | { type: 'destroyed'; shipId: EntityId; kind: ShipKind; position: Vec2; cause: DestroyCause }

/**
 * `player-fire` scores a point. `ram` is a Chaser exploding against the
 * player, which the brief says must not score.
 */
export type DestroyCause = 'player-fire' | 'enemy-fire' | 'ram'
