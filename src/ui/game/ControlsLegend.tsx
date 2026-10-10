import { KEY_BINDINGS, PAUSE_KEYS, RESTART_KEYS } from '@/input/keyboard'
import './ControlsLegend.css'

/** The keyboard controls, listed from the same bindings the game uses. */
export function ControlsLegend() {
  return (
    <dl className="controls-legend" aria-label="Keyboard controls">
      {[...KEY_BINDINGS, PAUSE_KEYS, RESTART_KEYS].map(({ keys, label }) => (
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
