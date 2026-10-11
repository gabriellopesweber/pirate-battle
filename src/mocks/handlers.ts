import { delay, http, HttpResponse } from 'msw'
import { type ApiError, isMatchRecord, type MatchConfig, MAX_PAGE_SIZE, PAGE_SIZE, type PageQuery } from '@/api/contracts'
import type { Rng } from '@/game/core/rng'
import type { MockDb } from '@/mocks/db'
import { paginate } from '@/mocks/ranking'
import { type Endpoint, planResponse, type ScenarioId } from '@/mocks/scenarios'

/**
 * The ranking and history REST API, answered from the mock db. Built for a
 * base URL so the browser worker and the Node test server share them.
 *
 *   GET  /ranking?sessionSeconds&spawnIntervalSeconds&page&pageSize
 *   GET  /players/:playerId/matches?page&pageSize
 *   POST /matches                     201 new · 200 already stored (same match id)
 */

/** How the network behaves: the active scenario, its seeded randomness, and how to wait. */
export interface NetworkConditions {
  scenario: () => ScenarioId
  rng: Rng
  /** Defaults to MSW's `delay`; tests inject a controllable one. */
  wait?: (ms: number) => Promise<void>
}

export function createHandlers(db: MockDb, apiBase: string, network?: NetworkConditions) {
  const url = (path: string) => `${apiBase.replace(/\/$/, '')}${path}`
  const wait = network?.wait ?? ((ms: number) => (ms > 0 ? delay(ms) : Promise.resolve()))
  let index = 0
  const sent = new Set<string>()

  /**
   * Applies the scenario's plan. The answer is computed first and delayed
   * after, as a real server reads and then the network is slow: a late answer
   * carries the data it was read at, and a registration is stored before its
   * answer is delayed.
   */
  async function respond(endpoint: Endpoint, firstSend: boolean, answer: () => Response, empty: () => Response) {
    const plan = network
      ? planResponse(network.scenario(), { endpoint, index: index++, firstSend }, network.rng)
      : { delayMs: 0, outcome: 'answer' as const }
    if (plan.outcome === 'network-error') {
      await wait(plan.delayMs)
      return HttpResponse.error()
    }
    const response =
      plan.outcome === 'answer'
        ? answer()
        : plan.outcome === 'empty'
          ? empty()
          : HttpResponse.json<ApiError>({ message: 'Simulated failure.' }, { status: plan.outcome })
    await wait(plan.delayMs)
    return response
  }

  return [
    // Lets the page check that the worker is answering for it (#42).
    http.get(url(MOCK_HEALTH_PATH), () => HttpResponse.json({ mock: true })),

    http.get(url('/ranking'), ({ request }) => {
      const params = new URL(request.url).searchParams
      const config = parseConfig(params)
      const query = parsePageQuery(params)
      if (!config) return badRequest('sessionSeconds and spawnIntervalSeconds must be numbers.')
      if (!query) return badRequest(PAGE_ERROR)
      return respond(
        'ranking',
        false,
        () => HttpResponse.json(db.ranking(config, query)),
        () => HttpResponse.json(emptyPage(db, query)),
      )
    }),

    http.get(url('/players/:playerId/matches'), ({ request, params }) => {
      const query = parsePageQuery(new URL(request.url).searchParams)
      if (!query) return badRequest(PAGE_ERROR)
      return respond(
        'history',
        false,
        () => HttpResponse.json(db.history(String(params.playerId), query)),
        () => HttpResponse.json(emptyPage(db, query)),
      )
    }),

    http.post(url('/matches'), async ({ request }) => {
      const body: unknown = await request.json().catch(() => null)
      if (!isMatchRecord(body)) return badRequest('The body is not a valid match record.')
      const firstSend = !sent.has(body.matchId)
      sent.add(body.matchId)
      return respond(
        'register',
        firstSend,
        () => {
          // Idempotent by match id: 201 when stored now, 200 with the stored record on a resend.
          const { record, created } = db.register(body)
          return HttpResponse.json(record, { status: created ? 201 : 200 })
        },
        () => HttpResponse.json(db.register(body).record),
      )
    }),
  ]
}

export const MOCK_HEALTH_PATH = '/mock-health'

const PAGE_ERROR = `page must be 1 or more; pageSize between 1 and ${String(MAX_PAGE_SIZE)}.`

const badRequest = (message: string) => HttpResponse.json<ApiError>({ message }, { status: 400 })

/** An empty page at the db's current revision, so it still orders correctly against others. */
const emptyPage = (db: MockDb, query: PageQuery) => paginate([], query, db.revision())

/** A missing value takes the default; a present but invalid one is rejected. */
function integerParam(params: URLSearchParams, name: string, fallback: number, max: number): number | null {
  const raw = params.get(name)
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null
}

function parsePageQuery(params: URLSearchParams): PageQuery | null {
  const page = integerParam(params, 'page', 1, Number.MAX_SAFE_INTEGER)
  const pageSize = integerParam(params, 'pageSize', PAGE_SIZE, MAX_PAGE_SIZE)
  return page === null || pageSize === null ? null : { page, pageSize }
}

function parseConfig(params: URLSearchParams): MatchConfig | null {
  const sessionSeconds = Number(params.get('sessionSeconds') ?? Number.NaN)
  const spawnIntervalSeconds = Number(params.get('spawnIntervalSeconds') ?? Number.NaN)
  return Number.isFinite(sessionSeconds) && Number.isFinite(spawnIntervalSeconds)
    ? { sessionSeconds, spawnIntervalSeconds }
    : null
}
