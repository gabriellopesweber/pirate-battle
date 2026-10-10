import { useCallback, useSyncExternalStore } from 'react'
import type { HudSnapshot, HudStore } from '@/render/hudStore'

/**
 * Reads the HUD store, re-rendering only when a displayed value changes.
 *
 * `subscribe` and `getSnapshot` are always called on the store, never handed
 * to React detached from it, and stay stable per store so React does not
 * resubscribe on every render.
 */
export function useHud(store: HudStore): HudSnapshot {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getSnapshot(), [store])
  return useSyncExternalStore(subscribe, getSnapshot)
}
