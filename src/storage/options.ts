import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { isValidOptions, optionsFromConfig, type PlayerOptions } from '@/game/config/options'
import { local, readJson, writeJson } from '@/storage/local'

const KEY = 'pirate-battle:options'

const isOptions = (value: unknown): value is PlayerOptions =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PlayerOptions).sessionSeconds === 'number' &&
  typeof (value as PlayerOptions).spawnIntervalSeconds === 'number' &&
  isValidOptions(value as PlayerOptions)

/** The saved options, or the defaults when none are saved or the saved ones are invalid. */
export function loadOptions(): PlayerOptions {
  return readJson(local, KEY, isOptions) ?? optionsFromConfig(DEFAULT_GAME_CONFIG)
}

export function saveOptions(options: PlayerOptions): void {
  writeJson(local, KEY, options)
}
