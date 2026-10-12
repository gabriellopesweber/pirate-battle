import { describe, expect, it, vi } from 'vitest'
import { InputState } from '@/input/inputState'
import { bindKeyboard } from '@/input/keyboard'

function key(type: 'keydown' | 'keyup', code: string, repeat = false) {
  return Object.assign(new Event(type, { cancelable: true }), { code, repeat })
}

function setup() {
  const target = new EventTarget()
  const input = new InputState()
  const onPause = vi.fn()
  const onRestart = vi.fn()
  const onToggleSound = vi.fn()
  const unbind = bindKeyboard(target, input, { onPause, onRestart, onToggleSound })
  const send = (type: 'keydown' | 'keyup', code: string, repeat = false) => {
    const event = key(type, code, repeat)
    target.dispatchEvent(event)
    return event
  }
  return { target, input, onPause, onRestart, onToggleSound, unbind, send }
}

describe('InputState', () => {
  it('reads held actions as player input', () => {
    const input = new InputState()

    input.press('thrust')
    input.press('turnRight')
    input.press('fireLeft')

    expect(input.read()).toEqual({ thrust: true, turn: 1, fireFront: false, fireLeft: true, fireRight: false })
  })

  it('cancels out both turn directions held together', () => {
    const input = new InputState()

    input.press('turnLeft')
    input.press('turnRight')

    expect(input.read().turn).toBe(0)
  })

  it('keeps an action held while any of its sources still holds it', () => {
    const input = new InputState()

    input.press('fireFront') // a key
    input.press('fireFront') // a finger
    input.release('fireFront')

    expect(input.read().fireFront).toBe(true)
    input.release('fireFront')
    expect(input.read().fireFront).toBe(false)
  })

  it('drops everything on reset, and a later release cannot go negative', () => {
    const input = new InputState()
    input.press('thrust')

    input.reset()
    input.release('thrust')
    input.press('thrust')

    expect(input.read().thrust).toBe(true)
  })
})

describe('bindKeyboard', () => {
  it('maps WASD and the arrows to movement, and allows moving and firing together', () => {
    const { input, send } = setup()

    send('keydown', 'KeyW')
    send('keydown', 'ArrowLeft')
    send('keydown', 'Space')
    send('keydown', 'KeyE')

    expect(input.read()).toEqual({ thrust: true, turn: -1, fireFront: true, fireLeft: false, fireRight: true })
  })

  it('releases on key up and ignores auto-repeat', () => {
    const { input, send } = setup()

    send('keydown', 'KeyD')
    send('keydown', 'KeyD', true)
    send('keyup', 'KeyD')

    expect(input.read().turn).toBe(0)
  })

  it('stops the page from scrolling on game keys only', () => {
    const { send } = setup()

    expect(send('keydown', 'Space').defaultPrevented).toBe(true)
    expect(send('keydown', 'ArrowUp').defaultPrevented).toBe(true)
    expect(send('keydown', 'Tab').defaultPrevented).toBe(false)
  })

  it('pauses on P or Escape, once per press', () => {
    const { onPause, send } = setup()

    send('keydown', 'KeyP')
    send('keydown', 'KeyP', true)
    send('keydown', 'Escape')

    expect(onPause).toHaveBeenCalledTimes(2)
  })

  it('restarts on R, once per press', () => {
    const { onRestart, send } = setup()

    send('keydown', 'KeyR')
    send('keydown', 'KeyR', true)

    expect(onRestart).toHaveBeenCalledOnce()
  })

  it('turns the sound on and off on M, once per press', () => {
    const { onToggleSound, send } = setup()

    send('keydown', 'KeyM')
    send('keydown', 'KeyM', true)

    expect(onToggleSound).toHaveBeenCalledOnce()
  })

  it('releases every held key and stops listening once unbound', () => {
    const { input, unbind, send } = setup()
    send('keydown', 'KeyW')
    send('keydown', 'KeyQ')

    unbind()
    send('keydown', 'Space')

    expect(input.read()).toEqual({ thrust: false, turn: 0, fireFront: false, fireLeft: false, fireRight: false })
  })
})
