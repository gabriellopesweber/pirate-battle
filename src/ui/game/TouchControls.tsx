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

const STEERING: readonly { action: Action; icon: string; label: string }[] = [
  { action: 'turnLeft', icon: 'icon_turn_left', label: 'Turn left' },
  { action: 'thrust', icon: 'icon_forward', label: 'Sail forward' },
  { action: 'turnRight', icon: 'icon_turn_right', label: 'Turn right' },
]

const WEAPONS: readonly { action: Action; icon: string; label: string }[] = [
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire port broadside' },
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire bow cannon' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire starboard broadside' },
]

/**
 * On-screen controls for touch screens. Each button tracks its own pointer,
 * so one thumb can steer while the other fires. Shown only on coarse pointers.
 */
export function TouchControls({ input, ui }: TouchControlsProps) {
  return (
    <div className="touch-controls">
      <div className="touch-controls__group">
        {STEERING.map((control) => (
          <TouchButton key={control.action} {...control} input={input} ui={ui} />
        ))}
      </div>
      <div className="touch-controls__group">
        {WEAPONS.map((control) => (
          <TouchButton key={control.action} {...control} input={input} ui={ui} />
        ))}
      </div>
    </div>
  )
}

interface TouchButtonProps {
  action: Action
  icon: string
  label: string
  input: InputState
  ui: Spritesheet
}

function TouchButton({ action, icon, label, input, ui }: TouchButtonProps) {
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
      className="touch-controls__button"
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
