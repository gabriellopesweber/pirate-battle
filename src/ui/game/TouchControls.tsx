import { type PointerEvent, useRef, useState } from 'react'
import type { Spritesheet } from 'pixi.js'
import type { Action, InputState } from '@/input/inputState'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import './TouchControls.css'

interface TouchControlsProps {
  input: InputState
  ui: Spritesheet
}

// Round button 64 × 64 with a 32 × 32 icon centred, as the UI atlas metadata lays it out.
const BUTTON_SIZE = 64

/** Where a button sits in its thumb cluster: one on top, one on each side below it. */
type Slot = 'top' | 'left' | 'right'

interface Control {
  action: Action
  icon: string
  label: string
  slot: Slot
}

const STEERING: readonly Control[] = [
  { action: 'thrust', icon: 'icon_forward', label: 'Sail forward', slot: 'top' },
  { action: 'turnLeft', icon: 'icon_turn_left', label: 'Turn left', slot: 'left' },
  { action: 'turnRight', icon: 'icon_turn_right', label: 'Turn right', slot: 'right' },
]

const WEAPONS: readonly Control[] = [
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire bow cannon', slot: 'top' },
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire port broadside', slot: 'left' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire starboard broadside', slot: 'right' },
]

/**
 * On-screen controls for touch screens, as two thumb clusters: steering under
 * the left thumb (forward on top, a turn on each side), weapons under the right
 * (bow cannon on top, a broadside on each side). Each button tracks its own
 * pointer, so one thumb can steer while the other fires. Shown only on coarse
 * pointers.
 */
export function TouchControls({ input, ui }: TouchControlsProps) {
  return (
    <div className="touch-controls">
      <div className="touch-controls__cluster">
        {STEERING.map((control) => (
          <TouchButton key={control.action} {...control} input={input} ui={ui} />
        ))}
      </div>
      <div className="touch-controls__cluster">
        {WEAPONS.map((control) => (
          <TouchButton key={control.action} {...control} input={input} ui={ui} />
        ))}
      </div>
    </div>
  )
}

interface TouchButtonProps extends Control {
  input: InputState
  ui: Spritesheet
}

function TouchButton({ action, icon, label, slot, input, ui }: TouchButtonProps) {
  // The ref guards against double press/release; the state only drives the pressed look.
  const held = useRef(false)
  const [pressed, setPressed] = useState(false)

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (held.current) return
    held.current = true
    input.press(action)
    setPressed(true)
  }

  const release = () => {
    if (!held.current) return
    held.current = false
    input.release(action)
    setPressed(false)
  }

  return (
    <button
      type="button"
      className={`touch-controls__button touch-controls__button--${slot}`}
      aria-label={label}
      tabIndex={-1}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => {
        event.preventDefault()
      }}
    >
      <AtlasSprite sheet={ui} frame={pressed ? 'button_round_pressed' : 'button_round_normal'} width={BUTTON_SIZE} />
      <AtlasSprite sheet={ui} frame={icon} width={BUTTON_SIZE / 2} className="touch-controls__icon" />
    </button>
  )
}
