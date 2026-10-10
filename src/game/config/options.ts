import type { GameConfig } from './gameConfig'

/** The two parameters the Options screen exposes. */
export interface PlayerOptions {
  sessionSeconds: number
  spawnIntervalSeconds: number
}

export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  // Below 1 s the arena saturates at the alive-enemy cap within seconds;
  // above 10 s a 60 s match may see too few enemies to show both types.
  spawnIntervalSeconds: { min: 1, max: 10, step: 0.5 },
} as const

export type OptionField = keyof PlayerOptions

export type OptionErrors = Partial<Record<OptionField, string>>

export function optionsFromConfig(config: GameConfig): PlayerOptions {
  return {
    sessionSeconds: config.match.durationSeconds,
    spawnIntervalSeconds: config.spawn.intervalSeconds,
  }
}

/** Returns one message per invalid field; an empty object means valid. */
export function validateOptions(options: PlayerOptions): OptionErrors {
  const errors: OptionErrors = {}
  for (const field of Object.keys(OPTION_LIMITS) as OptionField[]) {
    const { min, max } = OPTION_LIMITS[field]
    const value = options[field]
    if (!Number.isFinite(value)) {
      errors[field] = 'Enter a number.'
    } else if (value < min || value > max) {
      errors[field] = `Must be between ${String(min)} and ${String(max)} seconds.`
    }
  }
  return errors
}

export function isValidOptions(options: PlayerOptions): boolean {
  return Object.keys(validateOptions(options)).length === 0
}

/**
 * The configuration a match runs with: the base config plus the player's
 * options, deep-frozen. Taken once when a match starts, so changing options
 * afterwards only affects new matches.
 */
export function createMatchConfig(base: GameConfig, options: PlayerOptions): Readonly<GameConfig> {
  if (!isValidOptions(options)) {
    throw new Error('createMatchConfig received invalid options')
  }
  const snapshot = structuredClone(base)
  snapshot.match.durationSeconds = options.sessionSeconds
  snapshot.spawn.intervalSeconds = options.spawnIntervalSeconds
  return deepFreeze(snapshot)
}

function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value)) {
    if (typeof child === 'object' && child !== null) deepFreeze(child as object)
  }
  return Object.freeze(value)
}
