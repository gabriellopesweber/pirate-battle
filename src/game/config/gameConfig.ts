// Every balancing number in the game lives here. Systems read from a
// `GameConfig` snapshot and never hardcode values, so rebalancing is a data
// change only.
//
// Units: time in seconds, distance in world units (1 unit = 1 CSS pixel at the
// 1x asset scale), angles in radians, speeds per second.

export interface ShipStats {
  maxHealth: number
  /** Top forward speed. */
  maxSpeed: number
  /** Forward acceleration and deceleration. */
  acceleration: number
  /** Rotation speed. */
  turnSpeed: number
  /** Collision radius. */
  radius: number
}

export interface WeaponStats {
  cooldownSeconds: number
  damage: number
  projectileSpeed: number
  /** Range is `projectileSpeed * projectileLifetimeSeconds`. */
  projectileLifetimeSeconds: number
  projectileRadius: number
}

export interface BroadsideStats extends WeaponStats {
  /** Parallel projectiles per shot. */
  projectileCount: number
  /** Distance between parallel projectiles, along the ship's length. */
  spacing: number
}

export interface PlayerConfig extends ShipStats {
  frontWeapon: WeaponStats
  broadside: BroadsideStats
}

export interface ChaserConfig extends ShipStats {
  /** Damage dealt to the player when the Chaser rams and explodes. */
  contactDamage: number
}

export interface ShooterConfig extends ShipStats {
  weapon: WeaponStats
  /** Fires only while the player is closer than this. */
  attackRange: number
  /** Stops approaching once this close, to keep shooting from a distance. */
  preferredDistance: number
}

export interface SpawnConfig {
  intervalSeconds: number
  /** No spawn happens while this many enemies are alive. */
  maxAliveEnemies: number
  /** Relative weights; they do not need to add up to 1. */
  weights: { chaser: number; shooter: number }
  /** Spawn points closer than this to the player are rejected. */
  minDistanceFromPlayer: number
  /** Spawn points closer than this to an island or arena edge are rejected. */
  clearance: number
}

export interface ArenaConfig {
  width: number
  height: number
}

export interface SimulationConfig {
  /** Fixed simulation step. */
  stepSeconds: number
  /** Cap on steps per rendered frame, so a long stall cannot freeze the tab. */
  maxStepsPerFrame: number
}

export interface GameConfig {
  match: { durationSeconds: number }
  arena: ArenaConfig
  simulation: SimulationConfig
  spawn: SpawnConfig
  player: PlayerConfig
  chaser: ChaserConfig
  shooter: ShooterConfig
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  match: { durationSeconds: 120 },
  // 25 × 14 tiles of 64 units — a 16:9-ish world the renderer letterboxes.
  arena: { width: 1600, height: 896 },
  simulation: { stepSeconds: 1 / 60, maxStepsPerFrame: 5 },
  spawn: {
    intervalSeconds: 3,
    maxAliveEnemies: 8,
    weights: { chaser: 1, shooter: 1 },
    minDistanceFromPlayer: 420,
    clearance: 48,
  },
  player: {
    maxHealth: 100,
    maxSpeed: 170,
    acceleration: 220,
    turnSpeed: 2.6,
    radius: 26,
    frontWeapon: {
      cooldownSeconds: 0.35,
      damage: 20,
      projectileSpeed: 460,
      projectileLifetimeSeconds: 1.1,
      projectileRadius: 6,
    },
    broadside: {
      cooldownSeconds: 1.4,
      damage: 15,
      projectileSpeed: 380,
      projectileLifetimeSeconds: 0.9,
      projectileRadius: 6,
      projectileCount: 3,
      spacing: 18,
    },
  },
  chaser: {
    maxHealth: 40,
    maxSpeed: 150,
    acceleration: 200,
    turnSpeed: 2.2,
    radius: 22,
    contactDamage: 25,
  },
  shooter: {
    maxHealth: 60,
    maxSpeed: 100,
    acceleration: 140,
    turnSpeed: 1.6,
    radius: 26,
    attackRange: 400,
    preferredDistance: 300,
    weapon: {
      cooldownSeconds: 1.8,
      damage: 10,
      projectileSpeed: 300,
      projectileLifetimeSeconds: 1.6,
      projectileRadius: 6,
    },
  },
}
