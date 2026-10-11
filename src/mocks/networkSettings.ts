import { DEFAULT_SCENARIO, isScenarioId, type ScenarioId } from '@/mocks/scenarios'
import { readJson, writeJson } from '@/storage/local'

/**
 * Which network scenario the mock API plays, and the seed of its randomness.
 * Kept locally so a refresh replays the same conditions; the URL
 * (`?scenario=timeout&seed=7`) wins over what is kept, so a link or a test
 * selects a scenario on its own.
 */
export interface NetworkSettings {
  scenario: ScenarioId
  seed: number
}

export const DEFAULT_NETWORK: NetworkSettings = { scenario: DEFAULT_SCENARIO, seed: 1 }

const isSettings = (value: unknown): value is NetworkSettings =>
  typeof value === 'object' &&
  value !== null &&
  isScenarioId((value as NetworkSettings).scenario) &&
  Number.isInteger((value as NetworkSettings).seed)

/** The settings a URL asks for; anything missing or invalid keeps `saved`. */
export function settingsFromUrl(search: string, saved: NetworkSettings): NetworkSettings {
  const params = new URLSearchParams(search)
  const scenario = params.get('scenario')
  const seed = Number(params.get('seed') ?? Number.NaN)
  return {
    scenario: isScenarioId(scenario) ? scenario : saved.scenario,
    seed: Number.isInteger(seed) ? seed : saved.seed,
  }
}

export interface NetworkSettingsStore {
  get: () => NetworkSettings
  set: (next: NetworkSettings) => void
  subscribe: (listener: () => void) => () => void
}

export function createNetworkSettingsStore({
  storage,
  key,
}: {
  storage: () => Storage
  key: string
}): NetworkSettingsStore {
  let settings = readJson(storage, key, isSettings) ?? DEFAULT_NETWORK
  const listeners = new Set<() => void>()
  return {
    get: () => settings,
    set(next) {
      settings = next
      writeJson(storage, key, settings)
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
