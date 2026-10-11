import { useState } from 'react'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/game/config/gameConfig'
import { createMatchConfig } from '@/game/config/options'
import type { MatchResult } from '@/game/match/match'
import { loadLastResult, saveLastResult, type StoredResult } from '@/storage/lastResult'
import { readJson, removeKey, session, writeJson } from '@/storage/local'
import { loadOptions, saveOptions } from '@/storage/options'
import { loadPlayer } from '@/storage/player'
import { AssetGate } from '@/ui/assets/AssetGate'
import { AssetsContext } from '@/ui/assets/AssetsContext'
import { GameView } from '@/ui/game/GameView'
import { MainMenu } from '@/ui/screens/MainMenu'
import { OptionsScreen } from '@/ui/screens/OptionsScreen'
import { ResultScreen } from '@/ui/screens/ResultScreen'
import '@/ui/screens/screens.css'

type Screen =
  | { name: 'menu' }
  | { name: 'options' }
  | { name: 'game'; config: Readonly<GameConfig> }
  | { name: 'result'; result: StoredResult }

// Which screen a refresh returns to. Only the result screen is restored: a
// refresh during combat abandons the match and lands on the menu.
const SCREEN_KEY = 'pirate-battle:screen'
const isResultMarker = (value: unknown): value is 'result' => value === 'result'

function initialScreen(): Screen {
  const result = readJson(session, SCREEN_KEY, isResultMarker) ? loadLastResult() : null
  return result ? { name: 'result', result } : { name: 'menu' }
}

/**
 * The screen flow: menu ⇄ options, menu → game → result → game | menu.
 * The assets load once, behind a progress bar, before any screen shows.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [player] = useState(loadPlayer)

  const go = (next: Screen) => {
    if (next.name === 'result') writeJson(session, SCREEN_KEY, 'result')
    else removeKey(session, SCREEN_KEY)
    setScreen(next)
  }
  const toMenu = () => {
    go({ name: 'menu' })
  }

  // Each match takes a snapshot of the options saved when it starts.
  const play = () => {
    go({ name: 'game', config: createMatchConfig(DEFAULT_GAME_CONFIG, loadOptions()) })
  }

  const finish = (result: MatchResult) => {
    const stored: StoredResult = {
      score: result.score,
      durationSeconds: result.durationSeconds,
      reason: result.reason,
      endedAt: new Date().toISOString(),
    }
    saveLastResult(stored)
    go({ name: 'result', result: stored })
  }

  return (
    <main className="app">
      <AssetGate>
        {(assets) => (
          <AssetsContext value={assets}>
            {screen.name === 'menu' && (
              <MainMenu
                config={loadOptions()}
                playerId={player.id}
                onPlay={play}
                onOptions={() => {
                  go({ name: 'options' })
                }}
              />
            )}
            {screen.name === 'options' && <OptionsScreen initial={loadOptions()} onSave={saveOptions} onBack={toMenu} />}
            {screen.name === 'game' && <GameView config={screen.config} onEnd={finish} onMainMenu={toMenu} />}
            {screen.name === 'result' && <ResultScreen result={screen.result} onPlayAgain={play} onMainMenu={toMenu} />}
          </AssetsContext>
        )}
      </AssetGate>
    </main>
  )
}
