import type { Action, InputState } from '@/input/inputState'

export interface KeyBinding {
  action: Action
  /** `KeyboardEvent.code` values — physical keys, so WASD works on any layout. */
  codes: readonly string[]
  /** How the keys are shown in the controls legend. */
  keys: string
  label: string
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  { action: 'thrust', codes: ['KeyW', 'ArrowUp'], keys: 'W / ↑', label: 'Sail forward' },
  { action: 'turnLeft', codes: ['KeyA', 'ArrowLeft'], keys: 'A / ←', label: 'Turn left' },
  { action: 'turnRight', codes: ['KeyD', 'ArrowRight'], keys: 'D / →', label: 'Turn right' },
  { action: 'fireFront', codes: ['Space'], keys: 'Space', label: 'Fire bow cannon' },
  { action: 'fireLeft', codes: ['KeyQ'], keys: 'Q', label: 'Fire port broadside' },
  { action: 'fireRight', codes: ['KeyE'], keys: 'E', label: 'Fire starboard broadside' },
]

export const PAUSE_KEYS = { codes: ['KeyP', 'Escape'], keys: 'P / Esc', label: 'Pause' } as const
export const RESTART_KEYS = { codes: ['KeyR'], keys: 'R', label: 'Restart' } as const
export const SOUND_KEYS = { codes: ['KeyM'], keys: 'M', label: 'Sound on / off' } as const

export interface KeyboardCommands {
  onPause: () => void
  onRestart: () => void
  onToggleSound: () => void
}

const ACTION_BY_CODE = new Map<string, Action>(
  KEY_BINDINGS.flatMap(({ action, codes }) => codes.map((code) => [code, action] as const)),
)

interface KeyLike {
  readonly code: string
  readonly repeat: boolean
  readonly target: EventTarget | null
  preventDefault(): void
}

/**
 * Feeds keyboard input into `input` until the returned function is called.
 *
 * Bound only while a match is running: unbinding releases every key still
 * held, so a key held across a pause or into a menu never reaches the game.
 * Bound keys do not scroll the page; keys typed into a form field are ignored.
 */
export function bindKeyboard(target: EventTarget, input: InputState, commands: KeyboardCommands): () => void {
  const down = new Set<string>()

  const onKeyDown = (event: Event) => {
    const key = event as unknown as KeyLike
    if (isEditable(key.target)) return
    if ((PAUSE_KEYS.codes as readonly string[]).includes(key.code)) {
      key.preventDefault()
      if (!key.repeat) commands.onPause()
      return
    }
    if ((RESTART_KEYS.codes as readonly string[]).includes(key.code)) {
      key.preventDefault()
      if (!key.repeat) commands.onRestart()
      return
    }
    if ((SOUND_KEYS.codes as readonly string[]).includes(key.code)) {
      key.preventDefault()
      if (!key.repeat) commands.onToggleSound()
      return
    }
    const action = ACTION_BY_CODE.get(key.code)
    if (!action) return
    key.preventDefault()
    if (down.has(key.code)) return
    down.add(key.code)
    input.press(action)
  }

  const onKeyUp = (event: Event) => {
    const key = event as unknown as KeyLike
    const action = ACTION_BY_CODE.get(key.code)
    if (!action || !down.has(key.code)) return
    down.delete(key.code)
    input.release(action)
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    for (const code of down) {
      const action = ACTION_BY_CODE.get(code)
      if (action) input.release(action)
    }
    down.clear()
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
