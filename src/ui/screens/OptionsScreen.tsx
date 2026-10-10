import { useState } from 'react'
import { OPTION_LIMITS, type OptionField, type PlayerOptions, validateOptions } from '@/game/config/options'
import { MenuButton } from '@/ui/kit/MenuButton'
import { Panel } from '@/ui/kit/Panel'
import { RoundButton } from '@/ui/kit/RoundButton'

interface OptionsScreenProps {
  initial: PlayerOptions
  onSave: (options: PlayerOptions) => void
  onBack: () => void
}

const FIELDS: readonly { field: OptionField; label: string }[] = [
  { field: 'sessionSeconds', label: 'Game session time' },
  { field: 'spawnIntervalSeconds', label: 'Enemy spawn time' },
]

/**
 * The two options the brief exposes. Values are checked as they change;
 * Save stays disabled while any is invalid, and a saved value survives a
 * refresh. Changes apply to the next match.
 */
export function OptionsScreen({ initial, onSave, onBack }: OptionsScreenProps) {
  // Kept as typed text, so a half-typed or empty value can be shown and explained.
  const [draft, setDraft] = useState<Record<OptionField, string>>({
    sessionSeconds: String(initial.sessionSeconds),
    spawnIntervalSeconds: String(initial.spawnIntervalSeconds),
  })
  const [saved, setSaved] = useState(false)

  const options: PlayerOptions = {
    sessionSeconds: draft.sessionSeconds.trim() === '' ? Number.NaN : Number(draft.sessionSeconds),
    spawnIntervalSeconds: draft.spawnIntervalSeconds.trim() === '' ? Number.NaN : Number(draft.spawnIntervalSeconds),
  }
  const errors = validateOptions(options)
  const valid = Object.keys(errors).length === 0

  const set = (field: OptionField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }
  const step = (field: OptionField, direction: 1 | -1) => {
    const { min, max, step: size } = OPTION_LIMITS[field]
    const current = Number.isFinite(options[field]) ? options[field] : min
    const next = Math.min(max, Math.max(min, Math.round((current + direction * size) / size) * size))
    set(field, String(next))
  }

  return (
    <Panel className="screen">
      <h1 className="screen-title">Options</h1>
      <form
        className="options"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid) return
          onSave(options)
          setSaved(true)
        }}
      >
        {FIELDS.map(({ field, label }) => {
          const { min, max, step: size } = OPTION_LIMITS[field]
          const error = errors[field]
          const inputId = `option-${field}`
          return (
            <div key={field} className="options__field">
              <label htmlFor={inputId}>{label}</label>
              <div className="options__control">
                <RoundButton
                  icon="icon_minus"
                  label={`Decrease ${label.toLowerCase()}`}
                  onClick={() => {
                    step(field, -1)
                  }}
                />
                <span className="options__value">
                  <input
                    id={inputId}
                    type="number"
                    inputMode="decimal"
                    min={min}
                    max={max}
                    step={size}
                    value={draft[field]}
                    aria-invalid={error !== undefined}
                    aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ''}`}
                    onChange={(event) => {
                      set(field, event.target.value)
                    }}
                  />
                  <span aria-hidden="true">s</span>
                </span>
                <RoundButton
                  icon="icon_plus"
                  label={`Increase ${label.toLowerCase()}`}
                  onClick={() => {
                    step(field, 1)
                  }}
                />
              </div>
              <p id={`${inputId}-hint`} className="screen__note">
                {String(min)}–{String(max)} seconds
              </p>
              {error && (
                <p id={`${inputId}-error`} className="options__error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )
        })}

        <div className="button-stack">
          <MenuButton type="submit" disabled={!valid}>
            Save
          </MenuButton>
          <MenuButton onClick={onBack}>Main Menu</MenuButton>
        </div>
        <p role="status" className="screen__note">
          {saved ? 'Options saved. They apply to your next match.' : ''}
        </p>
      </form>
    </Panel>
  )
}
