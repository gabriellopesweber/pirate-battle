import { useMemo } from 'react'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { createMatchConfig, optionsFromConfig } from '@/game/config/options'
import { randomSeed } from '@/game/core/rng'
import { AssetGate } from '@/ui/assets/AssetGate'
import { GameView } from '@/ui/game/GameView'

export function App() {
  // Temporary: straight into a match with the default options. The menu,
  // Options and the screen flow replace this in #11.
  const config = useMemo(() => createMatchConfig(DEFAULT_GAME_CONFIG, optionsFromConfig(DEFAULT_GAME_CONFIG)), [])
  const seed = useMemo(() => randomSeed(), [])

  return (
    <main className="app">
      <h1 className="app__title">Pirate Battle</h1>
      <AssetGate>{(assets) => <GameView assets={assets} config={config} seed={seed} />}</AssetGate>
    </main>
  )
}
