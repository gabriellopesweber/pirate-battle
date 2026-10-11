import type { Match } from '@/game/match/match'
import { circleIsClear } from '@/game/world/arena'

/**
 * A read-only picture of a match for browser tests: plain data that survives
 * JSON, copied so a test can never change the match through it. Tests act on
 * the game only through its real controls; this is how they see the effect.
 *
 * The types below are the contract with the tests and spell themselves out:
 * the E2E project type-checks this file without reaching into the game's
 * modules, and `snapshotMatch` fails to compile if the game drifts from them.
 */
export interface MatchSnapshot {
  status: 'running' | 'paused' | 'ended'
  score: number
  seed: number
  timeLeft: number
  /** Simulation time elapsed. */
  time: number
  /** Enemies spawned so far, including destroyed ones. */
  spawned: number
  arena: { width: number; height: number; islands: { left: number; top: number; right: number; bottom: number }[] }
  player: ShipSnapshot & { radius: number; onLand: boolean }
  enemies: (ShipSnapshot & { id: number; kind: 'chaser' | 'shooter' })[]
  projectiles: { id: number; side: 'player' | 'enemy'; position: Point }[]
  /** Seconds until each player weapon can fire again; 0 means ready. */
  weapons: { front: number; left: number; right: number }
  result: { score: number; durationSeconds: number; reason: 'time-up' | 'destroyed'; seed: number } | null
}

interface Point {
  x: number
  y: number
}

interface ShipSnapshot {
  position: Point
  heading: number
  speed: number
  health: number
  maxHealth: number
}

const point = ({ x, y }: Point): Point => ({ x, y })

export function snapshotMatch(match: Match): MatchSnapshot {
  const { world } = match
  const { player } = world
  const result = match.result

  return {
    status: match.status,
    score: match.score,
    seed: match.seed,
    timeLeft: match.timeLeftSeconds,
    time: world.time,
    spawned: world.spawner.count,
    arena: {
      width: world.arena.width,
      height: world.arena.height,
      islands: world.arena.islands.map(({ left, top, right, bottom }) => ({ left, top, right, bottom })),
    },
    player: {
      position: point(player.position),
      heading: player.heading,
      speed: player.speed,
      health: player.health,
      maxHealth: player.maxHealth,
      radius: player.radius,
      onLand: !circleIsClear(world.arena, player.position, player.radius),
    },
    enemies: [...world.enemies].map((enemy) => ({
      id: enemy.id,
      kind: enemy.kind,
      position: point(enemy.position),
      heading: enemy.heading,
      speed: enemy.speed,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
    })),
    projectiles: [...world.projectiles].map((projectile) => ({
      id: projectile.id,
      side: projectile.side,
      position: point(projectile.position),
    })),
    weapons: {
      front: world.playerWeapons.front.remaining,
      left: world.playerWeapons.left.remaining,
      right: world.playerWeapons.right.remaining,
    },
    // The config snapshot stays out: it is large, and tests read it from the options.
    result: result
      ? { score: result.score, durationSeconds: result.durationSeconds, reason: result.reason, seed: result.seed }
      : null,
  }
}
