import { useState } from 'react'
import { useAssets } from '@/ui/assets/AssetsContext'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import { ControlsLegend } from '@/ui/game/ControlsLegend'
import { MenuButton } from '@/ui/kit/MenuButton'
import { Panel } from '@/ui/kit/Panel'

type Tab = 'ranking' | 'history'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
]

interface MainMenuProps {
  onPlay: () => void
  onOptions: () => void
}

export function MainMenu({ onPlay, onOptions }: MainMenuProps) {
  const { ui } = useAssets()
  const [tab, setTab] = useState<Tab | null>(null)

  return (
    <Panel className="screen">
      <h1 className="screen__title-art">
        <AtlasSprite sheet={ui} frame="title_pirate_battle" width={300} />
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
        <ControlsLegend />
        <p className="screen__note">On a touch screen, use the on-screen buttons.</p>
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
      {TABS.map(({ id, label }) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id}>
          {/* Filled by the ranking and history API (#12). */}
          <p className="screen__note">{label} will appear here.</p>
        </div>
      ))}
    </Panel>
  )
}
