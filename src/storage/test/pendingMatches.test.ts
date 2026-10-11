import { describe, expect, it, vi } from 'vitest'
import { createPendingStore } from '@/storage/pendingMatches'
import { makeMatch } from '@/test-utils/factories'
import { MemoryStorage } from '@/test-utils/memoryStorage'

const KEY = 'test:pending'

function setup() {
  const storage = new MemoryStorage()
  const open = () => createPendingStore({ storage: () => storage, key: KEY })
  return { storage, open }
}

const ids = (records: readonly { matchId: string }[]) => records.map((record) => record.matchId)

describe('createPendingStore', () => {
  it('starts empty', () => {
    expect(setup().open().list()).toEqual([])
  })

  it('keeps added registrations in the order they were added', () => {
    const store = setup().open()

    store.add(makeMatch({ matchId: 'a' }))
    store.add(makeMatch({ matchId: 'b' }))

    expect(ids(store.list())).toEqual(['a', 'b'])
  })

  it('ignores a match that is already pending', () => {
    const store = setup().open()
    const match = makeMatch({ matchId: 'a' })

    store.add(match)
    store.add(match)

    expect(store.list()).toHaveLength(1)
  })

  it('removes a registration once it is confirmed', () => {
    const store = setup().open()
    store.add(makeMatch({ matchId: 'a' }))
    store.add(makeMatch({ matchId: 'b' }))

    store.remove('a')

    expect(ids(store.list())).toEqual(['b'])
    expect(store.has('a')).toBe(false)
    expect(store.has('b')).toBe(true)
  })

  it('keeps pending registrations across a refresh', () => {
    const { open } = setup()
    open().add(makeMatch({ matchId: 'a' }))

    expect(ids(open().list())).toEqual(['a'])
  })

  it('drops an unreadable stored queue instead of crashing', () => {
    const { storage, open } = setup()
    storage.setItem(KEY, '[{"matchId":"half a record"}]')

    expect(open().list()).toEqual([])
  })

  it('keeps working in memory when storage is unavailable', () => {
    const store = createPendingStore({
      storage: () => {
        throw new Error('blocked')
      },
      key: KEY,
    })

    store.add(makeMatch({ matchId: 'a' }))

    expect(ids(store.list())).toEqual(['a'])
  })

  it('notifies subscribers on every change, and the list keeps its identity in between', () => {
    const store = setup().open()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const before = store.list()

    expect(store.list()).toBe(before)
    store.add(makeMatch({ matchId: 'a' }))
    store.remove('a')
    unsubscribe()
    store.add(makeMatch({ matchId: 'b' }))

    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.list()).not.toBe(before)
  })
})
