import { isAxiosError } from 'axios'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { MatchRecord, Page, RankingEntry } from '@/api/contracts'
import { createHttp } from '@/api/http'
import { createScoresRepository } from '@/api/scoresRepository'
import { createMockDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'
import { MemoryStorage } from '@/test-utils/memoryStorage'

// Real Axios client against the real handlers and db: only the network is
// intercepted, by MSW, the same way the browser worker does it.
const BASE = 'http://localhost/api'
const server = setupServer()
const repository = createScoresRepository(createHttp(BASE))
const signal = new AbortController().signal

const seed = () => [
  makeMatch({ matchId: 'a', playerId: 'rival', score: 9 }),
  makeMatch({ matchId: 'b', playerId: 'rival', score: 7 }),
  makeMatch({ matchId: 'c', playerId: 'rival', score: 5 }),
]

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  const db = createMockDb({ storage: () => new MemoryStorage(), key: 'test:db', seed })
  server.resetHandlers(...createHandlers(db, BASE))
})

afterAll(() => {
  server.close()
})

async function statusOf(request: Promise<unknown>): Promise<number | undefined> {
  try {
    await request
    return 200
  } catch (error) {
    return isAxiosError(error) ? error.response?.status : undefined
  }
}

describe('scoresRepository', () => {
  it('reads a ranking page for a config', async () => {
    const { data } = await repository.getRanking(DEFAULT_TEST_CONFIG, { page: 1, pageSize: 2 }, signal)

    const page = data as Page<RankingEntry>
    expect(page.items.map((entry) => [entry.rank, entry.matchId])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ])
    expect(page).toMatchObject({ page: 1, totalItems: 3, totalPages: 2 })
  })

  it('reads the following ranking page', async () => {
    const { data } = await repository.getRanking(DEFAULT_TEST_CONFIG, { page: 2, pageSize: 2 }, signal)

    expect((data as Page<RankingEntry>).items.map((entry) => entry.rank)).toEqual([3])
  })

  it('registers a match that the next history and ranking reads include', async () => {
    const mine = makeMatch({ matchId: 'mine', playerId: 'me', score: 99 })

    const { status } = await repository.registerMatch(mine)
    const history = await repository.getHistory('me', { page: 1, pageSize: 5 }, signal)
    const ranking = await repository.getRanking(DEFAULT_TEST_CONFIG, { page: 1, pageSize: 5 }, signal)

    expect(status).toBe(201)
    expect((history.data as Page<MatchRecord>).items).toEqual([mine])
    expect((ranking.data as Page<RankingEntry>).items[0]?.matchId).toBe('mine')
  })

  it('returns an empty history page for a player with no matches', async () => {
    const { data } = await repository.getHistory('nobody', { page: 1, pageSize: 5 }, signal)

    expect(data).toMatchObject({ items: [], totalItems: 0, totalPages: 0 })
  })

  it('rejects a page outside the allowed range with 400', async () => {
    expect(await statusOf(repository.getRanking(DEFAULT_TEST_CONFIG, { page: 0, pageSize: 5 }, signal))).toBe(400)
    expect(await statusOf(repository.getHistory('me', { page: 1, pageSize: 500 }, signal))).toBe(400)
  })

  it('rejects a malformed match record with 400', async () => {
    const broken = { ...makeMatch(), score: -1 }

    expect(await statusOf(repository.registerMatch(broken))).toBe(400)
  })
})
