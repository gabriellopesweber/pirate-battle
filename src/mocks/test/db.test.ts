import { describe, expect, it } from 'vitest'
import { createMockDb } from '@/mocks/db'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'
import { MemoryStorage } from '@/test-utils/memoryStorage'

const KEY = 'test:db'
const firstPage = { page: 1, pageSize: 10 }

function setup(seed = [makeMatch({ matchId: 'fixture', playerId: 'other' })]) {
  const storage = new MemoryStorage()
  const open = () => createMockDb({ storage: () => storage, key: KEY, seed: () => seed })
  return { storage, open }
}

describe('createMockDb', () => {
  it('starts from the seed when nothing is stored', () => {
    const db = setup().open()

    expect(db.ranking(DEFAULT_TEST_CONFIG, firstPage).items.map((entry) => entry.matchId)).toEqual(['fixture'])
  })

  it('shows a registered match in the next history and ranking queries', () => {
    const db = setup().open()

    db.register(makeMatch({ matchId: 'mine', playerId: 'me', score: 99 }))

    expect(db.history('me', firstPage).items.map((match) => match.matchId)).toEqual(['mine'])
    expect(db.ranking(DEFAULT_TEST_CONFIG, firstPage).items[0]?.matchId).toBe('mine')
  })

  it('returns the existing record when the same match is registered again, without a duplicate', () => {
    const db = setup().open()
    const first = makeMatch({ matchId: 'mine', playerId: 'me', score: 7 })

    expect(db.register(first)).toEqual({ record: first, created: true })
    const again = db.register({ ...first, score: 99 })

    expect(again).toEqual({ record: first, created: false })
    expect(db.history('me', firstPage).items).toEqual([first])
  })

  it('does not raise the revision for a resent match, since nothing changed', () => {
    const db = setup().open()
    const match = makeMatch({ playerId: 'me' })
    db.register(match)
    const before = db.history('me', firstPage).revision

    db.register(match)

    expect(db.history('me', firstPage).revision).toBe(before)
  })

  it('raises the revision on every registration', () => {
    const db = setup().open()
    const before = db.history('me', firstPage).revision

    db.register(makeMatch({ playerId: 'me' }))

    expect(db.history('me', firstPage).revision).toBe(before + 1)
  })

  it('keeps registered matches across a reload', () => {
    const { open } = setup()
    open().register(makeMatch({ matchId: 'mine', playerId: 'me' }))

    const reloaded = open()

    expect(reloaded.history('me', firstPage).totalItems).toBe(1)
  })

  it('falls back to the seed when the stored data is unreadable', () => {
    const { storage, open } = setup()
    storage.setItem(KEY, '{"revision":"nope"}')

    expect(open().ranking(DEFAULT_TEST_CONFIG, firstPage).totalItems).toBe(1)
  })

  it('reset discards registered matches and restores the seed', () => {
    const { open } = setup()
    const db = open()
    db.register(makeMatch({ playerId: 'me' }))

    db.reset()

    expect(db.history('me', firstPage).totalItems).toBe(0)
    expect(open().history('me', firstPage).totalItems).toBe(0)
  })

  it('reset still raises the revision, so pages read before it count as older', () => {
    const db = setup().open()
    const before = db.history('me', firstPage).revision

    db.reset()

    expect(db.history('me', firstPage).revision).toBeGreaterThan(before)
  })

  it('keeps working in memory when storage is unavailable', () => {
    const db = createMockDb({
      storage: () => {
        throw new Error('blocked')
      },
      key: KEY,
      seed: () => [],
    })

    db.register(makeMatch({ playerId: 'me' }))

    expect(db.history('me', firstPage).totalItems).toBe(1)
  })
})
