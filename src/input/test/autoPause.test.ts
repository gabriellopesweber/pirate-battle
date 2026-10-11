import { describe, expect, it, vi } from 'vitest'
import { watchFocusLoss } from '@/input/autoPause'

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
}

function setup() {
  const window = new EventTarget()
  const document = new FakeDocument()
  const onFocusLost = vi.fn()
  const stop = watchFocusLoss({ window, document }, onFocusLost)
  return { window, document, onFocusLost, stop }
}

describe('watchFocusLoss', () => {
  it('reports the window losing focus', () => {
    const { window, onFocusLost } = setup()

    window.dispatchEvent(new Event('blur'))

    expect(onFocusLost).toHaveBeenCalledOnce()
  })

  it('reports the tab being hidden, not shown again', () => {
    const { document, onFocusLost } = setup()

    document.visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    document.visibilityState = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onFocusLost).toHaveBeenCalledOnce()
  })

  it('stops listening once disposed', () => {
    const { window, document, onFocusLost, stop } = setup()

    stop()
    window.dispatchEvent(new Event('blur'))
    document.visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onFocusLost).not.toHaveBeenCalled()
  })
})
