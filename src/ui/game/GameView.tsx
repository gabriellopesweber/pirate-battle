import { useEffect, useRef, useState } from 'react'
import type { GameConfig } from '@/game/config/gameConfig'
import { randomSeed } from '@/game/core/rng'
import type { MatchResult } from '@/game/match/match'
import { InputState } from '@/input/inputState'
import type { GameAssets } from '@/render/assets'
import { GameSession } from '@/render/GameSession'
import { ControlsLegend } from '@/ui/game/ControlsLegend'
import { TouchControls } from '@/ui/game/TouchControls'
import { useHud } from '@/ui/game/useHud'
import './GameView.css'

interface GameViewProps {
  assets: GameAssets
  config: Readonly<GameConfig>
  seed: number
  onEnd?: (result: MatchResult) => void
}

/**
 * Mounts one game session into a container and tears it down on unmount.
 * React renders this component when the HUD changes — never per frame.
 *
 * Restarting starts a new session with a fresh seed: the effect cleanup
 * destroys the old one, so nothing of the previous match carries over.
 */
export function GameView({ assets, config, seed: firstSeed, onEnd }: GameViewProps) {
  const [seed, setSeed] = useState(firstSeed)
  const restart = () => {
    setSeed(randomSeed())
  }
  const latestRestart = useRef(restart)
  useEffect(() => {
    latestRestart.current = restart
  })
  const container = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  // One input state per mount, shared by the keyboard (inside the session) and the touch controls.
  const [input] = useState(() => new InputState())
  // The callback changes identity on every parent render; the session reads the latest.
  const latestOnEnd = useRef(onEnd)
  useEffect(() => {
    latestOnEnd.current = onEnd
  })

  useEffect(() => {
    const element = container.current
    if (!element) return
    const created = GameSession.create({
      container: element,
      assets,
      config,
      seed,
      input,
      onEnd: (result) => {
        latestOnEnd.current?.(result)
      },
      onRestart: () => {
        latestRestart.current()
      },
    })
    setSession(created)
    return () => {
      created.destroy()
      setSession(null)
    }
  }, [assets, config, seed, input])

  return (
    <div className="game-view">
      <div ref={container} className="game-view__canvas" />
      {session && <Hud session={session} assets={assets} onRestart={restart} />}
    </div>
  )
}

/** Temporary HUD; the full one, with the UI atlas and accessible status, comes with the screens (#11). */
function Hud({ session, assets, onRestart }: { session: GameSession; assets: GameAssets; onRestart: () => void }) {
  const hud = useHud(session.hud)
  const minutes = Math.floor(hud.secondsLeft / 60)
  const seconds = String(hud.secondsLeft % 60).padStart(2, '0')
  return (
    <>
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
        <button type="button" onClick={onRestart}>
          Restart
        </button>
      </div>
      <div className="game-view__legend">
        <ControlsLegend />
      </div>
      {hud.status === 'running' && <TouchControls input={session.input} ui={assets.ui} />}
    </>
  )
}
