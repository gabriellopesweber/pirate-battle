import { describe, expect, it, vi } from 'vitest'
import { createNetworkSettingsStore, DEFAULT_NETWORK, settingsFromUrl } from '@/mocks/networkSettings'
import { MemoryStorage } from '@/test-utils/memoryStorage'

describe('settingsFromUrl', () => {
  const saved = { scenario: 'slow', seed: 9 } as const

  it('keeps the saved settings when the URL names none', () => {
    expect(settingsFromUrl('', saved)).toEqual(saved)
    expect(settingsFromUrl('?other=1', saved)).toEqual(saved)
  })

  it('takes the scenario and the seed from the URL', () => {
    expect(settingsFromUrl('?scenario=offline&seed=42', saved)).toEqual({ scenario: 'offline', seed: 42 })
  })

  it('takes either one alone, keeping the other', () => {
    expect(settingsFromUrl('?scenario=empty', saved)).toEqual({ scenario: 'empty', seed: 9 })
    expect(settingsFromUrl('?seed=3', saved)).toEqual({ scenario: 'slow', seed: 3 })
  })

  it('ignores an unknown scenario or a seed that is not a whole number', () => {
    expect(settingsFromUrl('?scenario=chaos&seed=1.5', saved)).toEqual(saved)
  })
})

describe('createNetworkSettingsStore', () => {
  const setup = () => {
    const storage = new MemoryStorage()
    return { storage, open: () => createNetworkSettingsStore({ storage: () => storage, key: 'test:network' }) }
  }

  it('starts from the defaults', () => {
    expect(setup().open().get()).toEqual(DEFAULT_NETWORK)
  })

  it('keeps a change across a refresh', () => {
    const { open } = setup()
    open().set({ scenario: 'timeout', seed: 5 })

    expect(open().get()).toEqual({ scenario: 'timeout', seed: 5 })
  })

  it('falls back to the defaults when the stored settings are unreadable', () => {
    const { storage, open } = setup()
    storage.setItem('test:network', '{"scenario":"chaos","seed":1}')

    expect(open().get()).toEqual(DEFAULT_NETWORK)
  })

  it('notifies subscribers of a change', () => {
    const store = setup().open()
    const listener = vi.fn()
    store.subscribe(listener)

    store.set({ scenario: 'empty', seed: 1 })

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
