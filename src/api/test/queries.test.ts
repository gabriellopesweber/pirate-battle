import { http as route, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ContractError } from '@/api/apiError'
import type { Page, RankingEntry } from '@/api/contracts'
import { createHttp } from '@/api/http'
import { historyQuery, keepNewestPage, rankingQuery } from '@/api/queries'
import { createQueryClient } from '@/api/queryClient'
import { createScoresRepository } from '@/api/scoresRepository'
import { createMockDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'
import { MemoryStorage } from '@/test-utils/memoryStorage'

const BASE = 'http://localhost/api'
const server = setupServer()
const repository = createScoresRepository(createHttp(BASE))
// No waiting between retries: the policy is under test, not the backoff.
const newClient = () => createQueryClient({ retryDelay: 0 })

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  const seed = () => [makeMatch({ matchId: 'rival', playerId: 'rival', score: 4 })]
  server.resetHandlers(...createHandlers(createMockDb({ storage: () => new MemoryStorage(), key: 'db', seed }), BASE))
})

afterAll(() => {
  server.close()
})

/** Replaces the ranking endpoint with one answering from `responses` in turn, counting calls. */
function rankingAnswers(...responses: (() => Response)[]) {
  const calls = { count: 0 }
  server.use(
    route.get(`${BASE}/ranking`, () => {
      const respond = responses[Math.min(calls.count, responses.length - 1)]
      calls.count += 1
      return respond?.()
    }),
  )
  return calls
}

describe('rankingQuery', () => {
  it('fetches a ranking page validated against the contract', async () => {
    const page = await newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))

    expect(page.items.map((entry) => [entry.rank, entry.matchId])).toEqual([[1, 'rival']])
  })

  it('rejects an answer that does not match the contract, such as an HTML page', async () => {
    rankingAnswers(() => new HttpResponse('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))

    await expect(newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))).rejects.toBeInstanceOf(
      ContractError,
    )
  })

  it('retries a server error and succeeds once the server recovers', async () => {
    const real = await newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))
    const calls = rankingAnswers(
      () => new HttpResponse(null, { status: 503 }),
      () => new HttpResponse(null, { status: 503 }),
      () => HttpResponse.json(real),
    )

    const page = await newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))

    expect(page).toEqual(real)
    expect(calls.count).toBe(3)
  })

  it('gives up after two retries', async () => {
    const calls = rankingAnswers(() => new HttpResponse(null, { status: 503 }))

    await expect(newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))).rejects.toThrow()
    expect(calls.count).toBe(3)
  })

  it('does not retry a rejected request', async () => {
    const calls = rankingAnswers(() => HttpResponse.json({ message: 'bad' }, { status: 400 }))

    await expect(newClient().query(rankingQuery(repository, DEFAULT_TEST_CONFIG, 1))).rejects.toThrow()
    expect(calls.count).toBe(1)
  })
})

describe('historyQuery', () => {
  it("fetches the player's history page", async () => {
    await repository.registerMatch(makeMatch({ matchId: 'mine', playerId: 'me' }))

    const page = await newClient().query(historyQuery(repository, 'me', 1))

    expect(page.items.map((match) => match.matchId)).toEqual(['mine'])
  })
})

describe('keepNewestPage', () => {
  const pageAt = (revision: number, matchId: string): Page<RankingEntry> => ({
    items: [{ ...makeMatch({ matchId }), rank: 1 }],
    page: 1,
    pageSize: 5,
    totalItems: 1,
    totalPages: 1,
    revision,
  })

  it('keeps the cached page when a late response was read at an older revision', () => {
    const cached = pageAt(5, 'new')

    expect(keepNewestPage(cached, pageAt(4, 'stale'))).toBe(cached)
  })

  it('takes a response read at the same or a newer revision', () => {
    const newer = pageAt(6, 'newer')

    expect(keepNewestPage(pageAt(5, 'old'), newer)).toEqual(newer)
  })

  it('takes the first response when nothing is cached', () => {
    const first = pageAt(1, 'first')

    expect(keepNewestPage(undefined, first)).toEqual(first)
  })
})
