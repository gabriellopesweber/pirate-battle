import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { GameConfig } from '@/game/config/gameConfig'
import type { MatchResult } from '@/game/match/match'
import { IDLE_PLAYER_INPUT, type PlayerInput } from '@/game/world/state'
import type { GameAssets } from '@/render/assets'
import { GameSession } from '@/render/GameSession'
import type { HudStore } from '@/render/hudStore'
import './GameView.css'

interface GameViewProps {
  assets: GameAssets
  config: Readonly<GameConfig>
  seed: number
  readInput?: () => PlayerInput
  onEnd?: (result: MatchResult) => void
}

/**
 * Mounts one game session into a container and tears it down on unmount.
 * React renders this component when the HUD changes — never per frame.
 */
export function GameView({ assets, config, seed, readInput, onEnd }: GameViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  // Callbacks change identity on every parent render; the session reads the latest.
  const callbacks = useRef({ readInput, onEnd })
  useEffect(() => {
    callbacks.current = { readInput, onEnd }
  })

  useEffect(() => {
    const element = container.current
    if (!element) return
    const created = GameSession.create({
      container: element,
      assets,
      config,
      seed,
      readInput: () => callbacks.current.readInput?.() ?? IDLE_PLAYER_INPUT,
      onEnd: (result) => {
        callbacks.current.onEnd?.(result)
      },
    })
    setSession(created)
    return () => {
      created.destroy()
      setSession(null)
    }
  }, [assets, config, seed])

  return (
    <div className="game-view">
      <div ref={container} className="game-view__canvas" />
      {session && <Hud store={session.hud} session={session} />}
    </div>
  )
}

/** Temporary HUD; the full one, with the UI atlas and accessible status, comes with the screens (#11). */
function Hud({ store, session }: { store: HudStore; session: GameSession }) {
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const minutes = Math.floor(hud.secondsLeft / 60)
  const seconds = String(hud.secondsLeft % 60).padStart(2, '0')
  return (
    <div className="game-view__hud">
      <span>
        Health {hud.health}/{hud.maxHealth}
      </span>
      <span>Score {hud.score}</span>
      <span>
        Time {minutes}:{seconds}
      </span>
      {hud.status === 'running' && (
        <button
          type="button"
          onClick={() => {
            session.pause('manual')
          }}
        >
          Pause
        </button>
      )}
      {hud.status === 'paused' && (
        <button
          type="button"
          onClick={() => {
            session.resume()
          }}
        >
          Resume
        </button>
      )}
      {hud.status === 'ended' && <span>Match over ({hud.endReason})</span>}
    </div>
  )
}
