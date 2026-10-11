import { isAxiosError } from 'axios'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { MatchRecord, Page, RankingEntry } from '@/api/contracts'
import { createHttp } from '@/api/http'
import { createScoresRepository } from '@/api/scoresRepository'
import { createRng } from '@/game/core/rng'
import { createMockDb, type MockDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { PAST_TIMEOUT_MS, type ScenarioId } from '@/mocks/scenarios'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'
import { MemoryStorage } from '@/test-utils/memoryStorage'

// The real client against the real handlers, under a scenario. Waiting is
// injected: each delay the plan asks for is recorded and released on demand,
// so the tests control time instead of sleeping.
const BASE = 'http://localhost/api'
const server = setupServer()
const repository = createScoresRepository(createHttp(BASE))
const signal = new AbortController().signal
const query = { page: 1, pageSize: 5 }

let scenario: ScenarioId = 'success'
let db: MockDb
let waits: { ms: number; release: () => void }[] = []

const wait = (ms: number) =>
  ms === 0
    ? Promise.resolve()
    : new Promise<void>((release) => {
        waits.push({ ms, release })
      })

/** Lets microtasks run until the handler is parked in `wait`. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  scenario = 'success'
  waits = []
  const rng = createRng(1)
  db = createMockDb({
    storage: () => new MemoryStorage(),
    key: 'db',
    seed: () => [makeMatch({ matchId: 'rival', playerId: 'rival', score: 4 })],
  })
  server.resetHandlers(...createHandlers(db, BASE, { scenario: () => scenario, rng: () => rng, wait }))
})

afterAll(() => {
  server.close()
})

async function failure(request: Promise<unknown>) {
  try {
    await request
    return 'answered'
  } catch (error) {
    if (!isAxiosError(error)) throw error
    return error.response ? error.response.status : 'no response'
  }
}

describe('handlers under a network scenario', () => {
  it('answers reads with empty pages in the empty scenario', async () => {
    scenario = 'empty'

    const { data } = await repository.getRanking(DEFAULT_TEST_CONFIG, query, signal)

    expect(data).toMatchObject({ items: [], totalItems: 0, totalPages: 0 })
  })

  it('fails the connection, or answers with the scenario status', async () => {
    scenario = 'offline'
    expect(await failure(repository.getHistory('me', query, signal))).toBe('no response')

    scenario = 'server-error'
    expect(await failure(repository.getRanking(DEFAULT_TEST_CONFIG, query, signal))).toBe(500)

    scenario = 'bad-request'
    expect(await failure(repository.registerMatch(makeMatch()))).toBe(400)
  })

  it('waits for the delay the scenario plans before answering', async () => {
    scenario = 'slow'

    const answer = repository.getRanking(DEFAULT_TEST_CONFIG, query, signal)
    await settle()

    expect(waits.map((w) => w.ms)).toEqual([2000])
    waits[0]?.release()
    expect((await answer).status).toBe(200)
  })

  it('answers the next read first, and the late answer carries the older revision it was read at', async () => {
    scenario = 'out-of-order'
    const arrived: string[] = []

    const late = repository.getRanking(DEFAULT_TEST_CONFIG, query, signal).finally(() => arrived.push('first sent'))
    await settle()
    db.register(makeMatch({ matchId: 'new', playerId: 'me', score: 99 }))
    const early = repository.getRanking(DEFAULT_TEST_CONFIG, query, signal).finally(() => arrived.push('second sent'))
    await settle()
    // Release in the order the plan says: shortest delay first.
    for (const w of [...waits].sort((a, b) => a.ms - b.ms)) {
      w.release()
      await settle()
    }

    const [lateAnswer, earlyAnswer] = await Promise.all([late, early])
    expect(arrived).toEqual(['second sent', 'first sent'])
    const latePage = lateAnswer.data as Page<RankingEntry>
    const earlyPage = earlyAnswer.data as Page<RankingEntry>
    expect(latePage.revision).toBeLessThan(earlyPage.revision)
    expect(latePage.items.map((entry) => entry.matchId)).toEqual(['rival'])
  })

  it('stores a match before its late first answer, and answers the resend at once with the same record', async () => {
    scenario = 'register-timeout'
    const mine = makeMatch({ matchId: 'mine', playerId: 'me' })

    let firstAnswered = false
    const firstSend = repository.registerMatch(mine).finally(() => {
      firstAnswered = true
    })
    await settle()

    expect(waits.map((w) => w.ms)).toEqual([PAST_TIMEOUT_MS])
    expect(db.history('me', query).items).toEqual([mine])
    const resend = await repository.registerMatch(mine)
    expect(firstAnswered).toBe(false)
    expect(resend.status).toBe(200)
    expect((resend.data as MatchRecord).matchId).toBe('mine')

    waits[0]?.release()
    await firstSend
    expect(db.history('me', query).totalItems).toBe(1)
  })
})
