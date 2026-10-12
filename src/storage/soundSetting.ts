import { local, readJson, writeJson } from '@/storage/local'

const KEY = 'pirate-battle:muted'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export interface SoundSetting {
  muted: () => boolean
  toggle: () => void
  /** Called on every change; returns the unsubscribe. Shaped for `useSyncExternalStore`. */
  subscribe: (listener: () => void) => () => void
}

/** Whether the game is muted, kept across refreshes. */
export function createSoundSetting(): SoundSetting {
  let muted = readJson(local, KEY, isBoolean) ?? false
  const listeners = new Set<() => void>()
  return {
    muted: () => muted,
    toggle: () => {
      muted = !muted
      writeJson(local, KEY, muted)
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
