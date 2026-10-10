import type { EndReason, MatchStatus, PauseReason } from '@/game/match/match'

/** What the interface shows about a running match. Only primitives, compared field by field. */
export interface HudSnapshot {
  status: MatchStatus
  pauseReason: PauseReason | null
  score: number
  /** Whole seconds left, rounded up — the HUD never needs more precision. */
  secondsLeft: number
  health: number
  maxHealth: number
  endReason: EndReason | null
}

// Function-typed properties, not methods: React's useSyncExternalStore
// receives `subscribe` and `getSnapshot` detached from the store.
export interface HudStore {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => HudSnapshot
  /** Publishes only when a displayed value changed; returns whether it did. */
  readonly publish: (next: HudSnapshot) => boolean
}

/**
 * The bridge from the game loop to React, read with `useSyncExternalStore`.
 *
 * The loop calls `publish` every frame, but listeners run only when a value
 * the HUD shows actually changes — a hit, a kill, a new second — so React
 * re-renders a few times per second at most, never per frame.
 */
export function createHudStore(initial: HudSnapshot): HudStore {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    publish: (next) => {
      const keys = Object.keys(next) as (keyof HudSnapshot)[]
      if (keys.every((key) => next[key] === snapshot[key])) return false
      snapshot = next
      for (const listener of listeners) listener()
      return true
    },
  }
}
