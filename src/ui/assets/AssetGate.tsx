import { type ReactNode, useEffect, useRef } from 'react'
import type { GameAssets } from '@/render/assets'
import { useGameAssets } from './useGameAssets'
import './AssetGate.css'

interface AssetGateProps {
  children: (assets: GameAssets) => ReactNode
}

/** Renders its children only once every combat texture has loaded. */
export function AssetGate({ children }: AssetGateProps) {
  const { state, retry } = useGameAssets()
  const retryButton = useRef<HTMLButtonElement>(null)

  // Move focus to the way out of the error, so keyboard users land on it.
  useEffect(() => {
    if (state.status === 'error') retryButton.current?.focus()
  }, [state.status])

  if (state.status === 'ready') return children(state.assets)

  if (state.status === 'error') {
    return (
      <div className="asset-gate" role="alert">
        <p className="asset-gate__message">The game could not load its graphics. Check your connection and try again.</p>
        <button ref={retryButton} type="button" className="asset-gate__retry" onClick={retry}>
          Retry
        </button>
      </div>
    )
  }

  const percent = Math.round(state.progress * 100)
  return (
    <div className="asset-gate">
      <p id="asset-gate-label" className="asset-gate__message">
        Loading the fleet…
      </p>
      <div
        className="asset-gate__bar"
        role="progressbar"
        aria-labelledby="asset-gate-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="asset-gate__fill" style={{ width: `${String(percent)}%` }} />
      </div>
    </div>
  )
}
