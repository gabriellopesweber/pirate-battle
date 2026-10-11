import { useState } from 'react'
import type { MatchConfig } from '@/api/contracts'
import { useAssets } from '@/ui/assets/AssetsContext'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import { ControlsCard } from '@/ui/game/ControlsLegend'
import { MenuButton } from '@/ui/kit/MenuButton'
import { Panel } from '@/ui/kit/Panel'
import { NetworkControls } from '@/ui/network/NetworkControls'
import { HistoryPanel } from '@/ui/scores/HistoryPanel'
import { RankingPanel } from '@/ui/scores/RankingPanel'

type Tab = 'ranking' | 'history'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
]

interface MainMenuProps {
  /** The saved options: the ranking shows matches played with them. */
  config: MatchConfig
  playerId: string
  onPlay: () => void
  onOptions: () => void
}

export function MainMenu({ config, playerId, onPlay, onOptions }: MainMenuProps) {
  const { ui } = useAssets()
  const [tab, setTab] = useState<Tab | null>(null)

  return (
    <Panel className="screen">
      <h1 className="screen__title-art">
        <AtlasSprite sheet={ui} frame="title_pirate_battle" width={260} />
        <span className="visually-hidden">Pirate Battle</span>
      </h1>
      <p className="screen__tagline">Set sail. Take command.</p>

      <div className="button-stack">
        <MenuButton onClick={onPlay}>Play</MenuButton>
        <MenuButton onClick={onOptions}>Options</MenuButton>
      </div>

      <section aria-labelledby="controls-title" className="screen__section">
        <h2 id="controls-title" className="screen__subtitle">
          Controls
        </h2>
        <ControlsCard />
      </section>

      <div role="tablist" aria-label="Scores" className="screen__tabs">
        {TABS.map(({ id, label }) => (
          <MenuButton
            key={id}
            variant="secondary"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => {
              setTab(tab === id ? null : id)
            }}
          >
            {label}
          </MenuButton>
        ))}
      </div>
      {/* A panel's content mounts only while its tab is open, so reopening a
          tab refetches its data. */}
      {TABS.map(({ id }) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id}>
          {tab === 'ranking' && id === 'ranking' && <RankingPanel config={config} playerId={playerId} />}
          {tab === 'history' && id === 'history' && <HistoryPanel playerId={playerId} />}
        </div>
      ))}

      <NetworkControls />
    </Panel>
  )
}
