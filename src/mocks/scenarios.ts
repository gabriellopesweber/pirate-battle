import { API_TIMEOUT_MS } from '@/api/http'
import type { Rng } from '@/game/core/rng'

/**
 * Network scenarios for the mock API: each one decides, per request, how long
 * the answer takes and what it is. Pure — the handlers only apply the plan —
 * and seeded, so a scenario with randomness replays the same way in tests.
 */

export const SCENARIO_IDS = [
  'success',
  'empty',
  'slow',
  'jitter',
  'out-of-order',
  'timeout',
  'offline',
  'server-error',
  'bad-request',
  'ranking-fails',
  'history-fails',
  'register-timeout',
  'register-offline',
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const DEFAULT_SCENARIO: ScenarioId = 'success'

export const SCENARIOS: Readonly<Record<ScenarioId, { label: string; description: string }>> = {
  success: { label: 'Success', description: 'Every request answers at once; the ranking has several pages.' },
  empty: { label: 'Empty lists', description: 'Ranking and history answer with no matches.' },
  slow: { label: 'Slow', description: 'Every answer takes about two seconds.' },
  jitter: { label: 'Variable latency', description: 'Each answer takes a different time, drawn from the seed.' },
  'out-of-order': {
    label: 'Out-of-order answers',
    description: 'Each read answers after the one sent next, so answers arrive out of order.',
  },
  timeout: { label: 'Timeout', description: 'Every answer arrives after the client has given up.' },
  offline: { label: 'Connection failure', description: 'Every request fails to reach the server.' },
  'server-error': { label: 'Server error (500)', description: 'Every request gets a 500.' },
  'bad-request': { label: 'Rejected request (400)', description: 'Every request gets a 400.' },
  'ranking-fails': { label: 'Ranking fails', description: 'Only the ranking answers with a 500.' },
  'history-fails': { label: 'History fails', description: 'Only the match history answers with a 500.' },
  'register-timeout': {
    label: 'Timeout after registering',
    description: 'The server stores a match but answers its first send too late; resends recover it.',
  },
  'register-offline': {
    label: 'Unavailable at match end',
    description: 'Registering fails to reach the server; switch back to Success to send it.',
  },
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && (SCENARIO_IDS as readonly string[]).includes(value)
}

export type Endpoint = 'ranking' | 'history' | 'register'

export interface ScenarioRequest {
  endpoint: Endpoint
  /** How many requests the mock answered before this one. */
  index: number
  /** Registration only: whether this match id has not been sent before. */
  firstSend: boolean
}

/** `answer` is the normal response; a number is an HTTP error status. */
export type Outcome = 'answer' | 'empty' | 'network-error' | 400 | 500

export interface ResponsePlan {
  delayMs: number
  outcome: Outcome
}

const SLOW_MS = 2_000
const JITTER_MS = { min: 100, max: 1_500 } as const
const OUT_OF_ORDER_MS = { late: 1_500, early: 100 } as const
/** Long enough that the client's own timeout fires first. */
export const PAST_TIMEOUT_MS = API_TIMEOUT_MS + 1_000

const isRead = (endpoint: Endpoint) => endpoint !== 'register'

const at = (delayMs: number, outcome: Outcome = 'answer'): ResponsePlan => ({ delayMs, outcome })
const now = (outcome: Outcome = 'answer') => at(0, outcome)

export function planResponse(scenario: ScenarioId, request: ScenarioRequest, rng: Rng): ResponsePlan {
  const { endpoint } = request
  switch (scenario) {
    case 'success':
      return now()
    case 'empty':
      return now(isRead(endpoint) ? 'empty' : 'answer')
    case 'slow':
      return at(SLOW_MS)
    case 'jitter':
      return at(rng.int(JITTER_MS.min, JITTER_MS.max))
    case 'out-of-order':
      // Alternating long and short delays: request n answers after request n + 1.
      return isRead(endpoint) ? at(request.index % 2 === 0 ? OUT_OF_ORDER_MS.late : OUT_OF_ORDER_MS.early) : now()
    case 'timeout':
      return at(PAST_TIMEOUT_MS)
    case 'offline':
      return now('network-error')
    case 'server-error':
      return now(500)
    case 'bad-request':
      return now(400)
    case 'ranking-fails':
      return now(endpoint === 'ranking' ? 500 : 'answer')
    case 'history-fails':
      return now(endpoint === 'history' ? 500 : 'answer')
    case 'register-timeout':
      // The handler stores the match before waiting, so the late answer
      // follows a real write — the client's resend must find it, not add it.
      return endpoint === 'register' && request.firstSend ? at(PAST_TIMEOUT_MS) : now()
    case 'register-offline':
      return now(endpoint === 'register' ? 'network-error' : 'answer')
  }
}
