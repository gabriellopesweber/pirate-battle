import { useEffect, useRef, useState } from 'react'
import type { GameConfig } from '@/game/config/gameConfig'
import { randomSeed } from '@/game/core/rng'
import type { MatchResult } from '@/game/match/match'
import { InputState } from '@/input/inputState'
import { GameSession } from '@/render/GameSession'
import { useAssets } from '@/ui/assets/AssetsContext'
import { ControlsLegend } from '@/ui/game/ControlsLegend'
import { Hud } from '@/ui/game/Hud'
import { TouchControls } from '@/ui/game/TouchControls'
import { useHud } from '@/ui/game/useHud'
import './GameView.css'

interface GameViewProps {
  config: Readonly<GameConfig>
  onEnd: (result: MatchResult) => void
  onMainMenu: () => void
}

/**
 * The combat screen: mounts one game session and tears it down on unmount,
 * so leaving the screen abandons the match. React renders this component
 * when the HUD changes — never per frame.
 *
 * Restarting starts a new session with a fresh seed: the effect cleanup
 * destroys the old one, so nothing of the previous match carries over.
 */
export function GameView({ config, onEnd, onMainMenu }: GameViewProps) {
  const assets = useAssets()
  const [seed, setSeed] = useState(randomSeed)
  const restart = () => {
    setSeed(randomSeed())
  }
  const container = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  // One input state per mount, shared by the keyboard (inside the session) and the touch controls.
  const [input] = useState(() => new InputState())
  // Callbacks change identity on every render; the session reads the latest.
  const latest = useRef({ onEnd, restart })
  useEffect(() => {
    latest.current = { onEnd, restart }
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
        latest.current.onEnd(result)
      },
      onRestart: () => {
        latest.current.restart()
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
      {session && <Overlay session={session} onRestart={restart} onMainMenu={onMainMenu} />}
    </div>
  )
}

interface OverlayProps {
  session: GameSession
  onRestart: () => void
  onMainMenu: () => void
}

function Overlay({ session, onRestart, onMainMenu }: OverlayProps) {
  const { status } = useHud(session.hud)
  const { ui } = useAssets()
  return (
    <>
      <Hud session={session} onRestart={onRestart} onMainMenu={onMainMenu} />
      <div className="game-view__legend">
        <ControlsLegend />
      </div>
      {status === 'running' && <TouchControls input={session.input} ui={ui} />}
    </>
  )
}
