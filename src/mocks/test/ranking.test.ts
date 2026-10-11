import { describe, expect, it } from 'vitest'
import { historyOf, paginate, rankMatches } from '@/mocks/ranking'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'

const ids = (items: readonly { matchId: string }[]) => items.map((item) => item.matchId)

describe('rankMatches', () => {
  it('orders matches by score, highest first, numbering ranks from 1', () => {
    const matches = [
      makeMatch({ matchId: 'low', score: 2 }),
      makeMatch({ matchId: 'high', score: 9 }),
      makeMatch({ matchId: 'mid', score: 5 }),
    ]

    const ranking = rankMatches(matches, DEFAULT_TEST_CONFIG)

    expect(ids(ranking)).toEqual(['high', 'mid', 'low'])
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3])
  })

  it('only compares matches played with the same config', () => {
    const matches = [
      makeMatch({ matchId: 'same', score: 3 }),
      makeMatch({ matchId: 'other-time', score: 9, config: { sessionSeconds: 60, spawnIntervalSeconds: 3 } }),
      makeMatch({ matchId: 'other-spawn', score: 9, config: { sessionSeconds: 120, spawnIntervalSeconds: 2 } }),
    ]

    expect(ids(rankMatches(matches, DEFAULT_TEST_CONFIG))).toEqual(['same'])
  })

  it('breaks a score tie in favour of the match that ended first', () => {
    const matches = [
      makeMatch({ matchId: 'later', score: 5, endedAt: '2026-10-02T00:00:00.000Z' }),
      makeMatch({ matchId: 'earlier', score: 5, endedAt: '2026-10-01T00:00:00.000Z' }),
    ]

    expect(ids(rankMatches(matches, DEFAULT_TEST_CONFIG))).toEqual(['earlier', 'later'])
  })

  it('breaks a tie on score and date by match id, so the order never depends on insertion', () => {
    const tied = { score: 5, endedAt: '2026-10-01T00:00:00.000Z' }
    const a = makeMatch({ ...tied, matchId: 'a' })
    const b = makeMatch({ ...tied, matchId: 'b' })

    expect(ids(rankMatches([b, a], DEFAULT_TEST_CONFIG))).toEqual(['a', 'b'])
    expect(ids(rankMatches([a, b], DEFAULT_TEST_CONFIG))).toEqual(['a', 'b'])
  })

  it('returns an empty ranking when no match used the config', () => {
    expect(rankMatches([makeMatch()], { sessionSeconds: 180, spawnIntervalSeconds: 10 })).toEqual([])
  })
})

describe('historyOf', () => {
  it("lists only the player's matches, most recent first", () => {
    const matches = [
      makeMatch({ matchId: 'old', endedAt: '2026-10-01T00:00:00.000Z' }),
      makeMatch({ matchId: 'someone-else', playerId: 'player-2' }),
      makeMatch({ matchId: 'new', endedAt: '2026-10-03T00:00:00.000Z' }),
    ]

    expect(ids(historyOf(matches, 'player-1'))).toEqual(['new', 'old'])
  })
})

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('returns the requested slice with the totals', () => {
    const page = paginate(items, { page: 2, pageSize: 3 }, 4)

    expect(page).toEqual({ items: ['d', 'e', 'f'], page: 2, pageSize: 3, totalItems: 7, totalPages: 3, revision: 4 })
  })

  it('returns a short last page', () => {
    expect(paginate(items, { page: 3, pageSize: 3 }, 0).items).toEqual(['g'])
  })

  it('returns no items past the last page, keeping the totals', () => {
    const page = paginate(items, { page: 4, pageSize: 3 }, 0)

    expect(page.items).toEqual([])
    expect(page.totalPages).toBe(3)
  })

  it('reports zero pages for an empty list', () => {
    expect(paginate([], { page: 1, pageSize: 3 }, 0)).toMatchObject({ items: [], totalItems: 0, totalPages: 0 })
  })
})
