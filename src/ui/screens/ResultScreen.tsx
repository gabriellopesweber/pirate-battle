import { useEffect, useRef } from 'react'
import type { StoredResult } from '@/storage/lastResult'
import { END_REASON_LABEL, formatClock } from '@/ui/format'
import { MenuButton } from '@/ui/kit/MenuButton'
import { Panel } from '@/ui/kit/Panel'
import { RegistrationStatus } from '@/ui/result/RegistrationStatus'

interface ResultScreenProps {
  result: StoredResult
  onPlayAgain: () => void
  onMainMenu: () => void
}

export function ResultScreen({ result, onPlayAgain, onMainMenu }: ResultScreenProps) {
  const playAgain = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    playAgain.current?.focus()
  }, [])

  return (
    <Panel className="screen">
      <h1 className="screen-title">{result.reason === 'time-up' ? 'Battle complete' : 'Your ship sank'}</h1>
      <p className="result__score">
        {result.score}
        <span className="visually-hidden"> points</span>
      </p>
      <dl className="result__facts">
        <div>
          <dt>Points</dt>
          <dd>{result.score}</dd>
        </div>
        <div>
          <dt>Time played</dt>
          <dd>{formatClock(result.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Ended by</dt>
          <dd>{END_REASON_LABEL[result.reason]}</dd>
        </div>
        <div>
          <dt>Match record</dt>
          <dd>
            <RegistrationStatus matchId={result.matchId} />
          </dd>
        </div>
      </dl>
      <div className="button-stack">
        <MenuButton ref={playAgain} onClick={onPlayAgain}>
          Play Again
        </MenuButton>
        <MenuButton onClick={onMainMenu}>Main Menu</MenuButton>
      </div>
    </Panel>
  )
}
