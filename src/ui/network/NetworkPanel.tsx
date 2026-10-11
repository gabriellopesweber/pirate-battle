import { useId } from 'react'
import { DEFAULT_SCENARIO, isScenarioId, SCENARIO_IDS, SCENARIOS, type ScenarioId } from '@/mocks/scenarios'
import './network.css'

interface NetworkPanelProps {
  scenario: ScenarioId
  onChange: (scenario: ScenarioId) => void
  onReset: () => void
}

/**
 * Picks how the mock ranking and history API behaves, and resets its data.
 * Collapsed by default: it is a way to demonstrate the failure handling, not
 * part of the game. The active scenario shows even when collapsed, flagged
 * whenever it is not the plain success one.
 */
export function NetworkPanel({ scenario, onChange, onReset }: NetworkPanelProps) {
  const selectId = useId()
  const descriptionId = useId()
  const simulating = scenario !== DEFAULT_SCENARIO

  return (
    <details className="network">
      <summary className="network__summary">
        <span className="network__chevron" aria-hidden="true" />
        <span className="network__title">Network scenario</span>
        <span className={`network__badge${simulating ? ' network__badge--simulating' : ''}`}>
          {SCENARIOS[scenario].label}
        </span>
      </summary>
      <div className="network__card">
        <label className="network__label" htmlFor={selectId}>
          Scenario
        </label>
        <select
          id={selectId}
          className="network__select"
          value={scenario}
          aria-describedby={descriptionId}
          onChange={(event) => {
            const next = event.target.value
            if (isScenarioId(next)) onChange(next)
          }}
        >
          {SCENARIO_IDS.map((id) => (
            <option key={id} value={id}>
              {SCENARIOS[id].label}
            </option>
          ))}
        </select>
        <p id={descriptionId} className="network__description">
          {SCENARIOS[scenario].description}
        </p>
        <button type="button" className="network__reset" onClick={onReset}>
          Reset data
        </button>
      </div>
    </details>
  )
}
