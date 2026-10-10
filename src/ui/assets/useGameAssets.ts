import { useCallback, useEffect, useState } from 'react'
import { type GameAssets, loadGameAssets } from '@/render/assets'

export type GameAssetsState =
  | { status: 'loading'; progress: number }
  | { status: 'ready'; assets: GameAssets }
  | { status: 'error'; error: Error }

/**
 * Loads the combat textures once per attempt and exposes progress, failure
 * and a retry. Safe under Strict Mode: a load whose effect was cleaned up
 * never writes state, and the second mount reuses PixiJS's cached loads.
 */
export function useGameAssets(): { state: GameAssetsState; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<GameAssetsState>({ status: 'loading', progress: 0 })

  useEffect(() => {
    let active = true
    let settled = false
    loadGameAssets((progress) => {
      // Other files keep reporting progress after one has failed; without
      // this guard they would flip the error back to "loading" and hide Retry.
      if (active && !settled) setState({ status: 'loading', progress })
    }).then(
      (assets) => {
        settled = true
        if (active) setState({ status: 'ready', assets })
      },
      (error: unknown) => {
        settled = true
        if (active) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', progress: 0 })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
