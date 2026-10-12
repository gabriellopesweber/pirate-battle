import type { CSSProperties } from 'react'
import type { GameSession } from '@/render/GameSession'
import { useAssets } from '@/ui/assets/AssetsContext'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import { frameImage } from '@/ui/atlas/frameImage'
import { MatchAnnouncer } from '@/ui/game/MatchAnnouncer'
import { useHud } from '@/ui/game/useHud'
import { MenuButton } from '@/ui/kit/MenuButton'
import { Panel } from '@/ui/kit/Panel'
import { RoundButton } from '@/ui/kit/RoundButton'
import { useDialogFocus } from '@/ui/kit/useDialogFocus'
import { formatClock } from '@/ui/format'
import './Hud.css'

interface HudProps {
  session: GameSession
  onRestart: () => void
  onMainMenu: () => void
}

/** Health, score, time and the pause controls, over the arena. Re-renders only on displayed changes. */
export function Hud({ session, onRestart, onMainMenu }: HudProps) {
  const hud = useHud(session.hud)
  const { ui } = useAssets()
  const counter: CSSProperties = { backgroundImage: `url("${frameImage(ui, 'counter_panel')}")` }
  const ratio = hud.maxHealth > 0 ? hud.health / hud.maxHealth : 0

  return (
    <>
      <MatchAnnouncer hud={hud} />
      <div className="hud">
        <div className="hud__health">
          <AtlasSprite sheet={ui} frame="icon_heart" width={32} />
          <div
            className="hud__bar"
            role="meter"
            aria-label="Health"
            aria-valuemin={0}
            aria-valuemax={hud.maxHealth}
            aria-valuenow={hud.health}
            style={{ backgroundImage: `url("${frameImage(ui, 'health_frame')}")` }}
          >
            <div
              className="hud__bar-fill"
              style={{
                backgroundImage: `url("${frameImage(ui, ratio > 2 / 3 ? 'health_fill_green' : ratio > 1 / 3 ? 'health_fill_amber' : 'health_fill_red')}")`,
                clipPath: `inset(0 ${String(100 - (11.7 + 76.6 * ratio))}% 0 0)`,
              }}
            />
            <span className="hud__bar-text">
              {hud.health} / {hud.maxHealth}
            </span>
          </div>
        </div>

        <div className="hud__right">
          <div className="hud__counter" style={counter}>
            <AtlasSprite sheet={ui} frame="icon_score" width={26} />
            <span>
              <span className="visually-hidden">Score </span>
              {hud.score}
            </span>
          </div>
          <div className="hud__counter" style={counter}>
            <AtlasSprite sheet={ui} frame="icon_time" width={26} />
            <span>
              <span className="visually-hidden">Time left </span>
              {formatClock(hud.secondsLeft)}
            </span>
          </div>
          {/* Stays mounted while paused, so the dialog can give focus back to it. */}
          <RoundButton
            icon="icon_pause"
            label="Pause"
            disabled={hud.status !== 'running'}
            onClick={() => {
              session.pause('manual')
            }}
          />
          <RoundButton icon="icon_restart" label="Restart" onClick={onRestart} />
        </div>
      </div>

      {hud.status === 'paused' && (
        <PauseDialog
          focusLost={hud.pauseReason === 'focus-lost'}
          onResume={() => {
            session.resume()
          }}
          onRestart={onRestart}
          onMainMenu={onMainMenu}
        />
      )}
    </>
  )
}

interface PauseDialogProps {
  focusLost: boolean
  onResume: () => void
  onRestart: () => void
  onMainMenu: () => void
}

function PauseDialog({ focusLost, onResume, onRestart, onMainMenu }: PauseDialogProps) {
  const { dialogRef, initialFocusRef } = useDialogFocus<HTMLButtonElement>()

  return (
    <div className="hud__overlay">
      <div role="dialog" aria-modal="true" aria-labelledby="pause-title" ref={dialogRef}>
        <Panel className="hud__dialog">
          <h2 id="pause-title" className="screen-title">
            Paused
          </h2>
          <p>{focusLost ? 'Paused while the game was in the background.' : 'Ready when you are.'}</p>
          <div className="button-stack">
            <MenuButton ref={initialFocusRef} onClick={onResume}>
              Resume
            </MenuButton>
            <MenuButton onClick={onRestart}>Restart</MenuButton>
            <MenuButton onClick={onMainMenu}>Main Menu</MenuButton>
          </div>
        </Panel>
      </div>
    </div>
  )
}
