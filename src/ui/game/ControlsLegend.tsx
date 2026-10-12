import type { Action } from '@/input/inputState'
import { KEY_BINDINGS, PAUSE_KEYS, RESTART_KEYS, SOUND_KEYS } from '@/input/keyboard'
import { useAssets } from '@/ui/assets/AssetsContext'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import './ControlsLegend.css'

interface Entry {
  label: string
  keys: string
}

const FULL: readonly Entry[] = [...KEY_BINDINGS, PAUSE_KEYS, RESTART_KEYS, SOUND_KEYS]

/** The first key of a binding ('W / ↑' → 'W'); the alternatives are noted below the card. */
const primaryKey = (keys: string): string => keys.split(' / ')[0] ?? keys
const keyOf = (action: Action): string =>
  primaryKey(KEY_BINDINGS.find((binding) => binding.action === action)?.keys ?? '')

interface CardEntry {
  label: string
  keys: readonly string[]
  icon: string
}

// Sibling actions share a row: six rows instead of eight. Keys still come
// from the bindings, so the card cannot drift from the real controls.
const CARD: readonly CardEntry[] = [
  { label: 'Sail', keys: [keyOf('thrust')], icon: 'icon_forward' },
  { label: 'Turn', keys: [keyOf('turnLeft'), keyOf('turnRight')], icon: 'icon_turn_left' },
  { label: 'Bow cannon', keys: [keyOf('fireFront')], icon: 'icon_fire_front' },
  { label: 'Broadsides', keys: [keyOf('fireLeft'), keyOf('fireRight')], icon: 'icon_fire_left' },
  { label: PAUSE_KEYS.label, keys: [primaryKey(PAUSE_KEYS.keys)], icon: 'icon_pause' },
  { label: RESTART_KEYS.label, keys: [RESTART_KEYS.keys], icon: 'icon_restart' },
]

/** The in-game legend: every binding, one per line. */
export function ControlsLegend() {
  return (
    <dl className="controls-legend" aria-label="Keyboard controls">
      {FULL.map(({ keys, label }) => (
        <div key={label} className="controls-legend__row">
          <dt>
            <kbd>{keys}</kbd>
          </dt>
          <dd>{label}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The menu's controls card: keycaps, the atlas icon of each action, two
 * columns — short enough to keep the menu panel from scrolling.
 */
export function ControlsCard() {
  const { ui } = useAssets()
  return (
    <div className="controls-card">
      <dl className="controls-card__grid" aria-label="Keyboard controls">
        {CARD.map(({ label, keys, icon }) => (
          <div key={label} className="controls-card__item">
            <dt className="controls-card__keys">
              {keys.map((key) => (
                <kbd key={key} className="keycap">
                  {key}
                </kbd>
              ))}
            </dt>
            <dd className="controls-card__action">
              <AtlasSprite sheet={ui} frame={icon} width={18} />
              {label}
            </dd>
          </div>
        ))}
      </dl>
      <p className="controls-card__note">
        Arrows steer too · Esc pauses · M mutes · touch screens use on-screen buttons
      </p>
    </div>
  )
}
