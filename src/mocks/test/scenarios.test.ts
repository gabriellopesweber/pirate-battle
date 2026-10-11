import { describe, expect, it } from 'vitest'
import { API_TIMEOUT_MS } from '@/api/http'
import { createRng } from '@/game/core/rng'
import {
  type Endpoint,
  isScenarioId,
  planResponse,
  SCENARIO_IDS,
  type ScenarioId,
  type ScenarioRequest,
} from '@/mocks/scenarios'

const request = (endpoint: Endpoint, overrides: Partial<ScenarioRequest> = {}): ScenarioRequest => ({
  endpoint,
  index: 0,
  firstSend: true,
  ...overrides,
})

const plan = (scenario: ScenarioId, endpoint: Endpoint, overrides: Partial<ScenarioRequest> = {}) =>
  planResponse(scenario, request(endpoint, overrides), createRng(1))

const ENDPOINTS: readonly Endpoint[] = ['ranking', 'history', 'register']

describe('planResponse', () => {
  it('answers at once in the success scenario', () => {
    for (const endpoint of ENDPOINTS) {
      expect(plan('success', endpoint)).toEqual({ delayMs: 0, outcome: 'answer' })
    }
  })

  it('answers reads with empty lists, and still registers matches', () => {
    expect(plan('empty', 'ranking').outcome).toBe('empty')
    expect(plan('empty', 'history').outcome).toBe('empty')
    expect(plan('empty', 'register').outcome).toBe('answer')
  })

  it('slows every answer down, without failing it', () => {
    for (const endpoint of ENDPOINTS) {
      const slow = plan('slow', endpoint)
      expect(slow.outcome).toBe('answer')
      expect(slow.delayMs).toBeGreaterThanOrEqual(1500)
      expect(slow.delayMs).toBeLessThan(API_TIMEOUT_MS)
    }
  })

  it('varies latency reproducibly from the seed', () => {
    const delays = (seed: number) => {
      const rng = createRng(seed)
      return [0, 1, 2, 3, 4].map((index) => planResponse('jitter', request('ranking', { index }), rng).delayMs)
    }

    expect(delays(7)).toEqual(delays(7))
    expect(new Set(delays(7)).size).toBeGreaterThan(1)
    expect(Math.max(...delays(7))).toBeLessThan(API_TIMEOUT_MS)
  })

  it('makes each read answer after the one sent next, so answers arrive out of order', () => {
    const first = plan('out-of-order', 'ranking', { index: 0 })
    const second = plan('out-of-order', 'ranking', { index: 1 })

    expect(first.delayMs).toBeGreaterThan(second.delayMs)
    expect(first.outcome).toBe('answer')
  })

  it('answers past the client timeout', () => {
    for (const endpoint of ENDPOINTS) {
      expect(plan('timeout', endpoint).delayMs).toBeGreaterThan(API_TIMEOUT_MS)
    }
  })

  it('fails the connection, or answers with a server or a client error', () => {
    expect(plan('offline', 'history').outcome).toBe('network-error')
    expect(plan('server-error', 'ranking').outcome).toBe(500)
    expect(plan('bad-request', 'register').outcome).toBe(400)
  })

  it('fails only the ranking, or only the history', () => {
    expect(plan('ranking-fails', 'ranking').outcome).toBe(500)
    expect(plan('ranking-fails', 'history').outcome).toBe('answer')
    expect(plan('history-fails', 'history').outcome).toBe(500)
    expect(plan('history-fails', 'ranking').outcome).toBe('answer')
  })

  it('stores a match but answers its first send past the timeout, then answers resends at once', () => {
    const first = plan('register-timeout', 'register', { firstSend: true })
    const resend = plan('register-timeout', 'register', { firstSend: false })

    expect(first).toEqual({ delayMs: expect.any(Number) as number, outcome: 'answer' })
    expect(first.delayMs).toBeGreaterThan(API_TIMEOUT_MS)
    expect(resend).toEqual({ delayMs: 0, outcome: 'answer' })
    expect(plan('register-timeout', 'history')).toEqual({ delayMs: 0, outcome: 'answer' })
  })

  it('makes registration unavailable while reads keep working', () => {
    expect(plan('register-offline', 'register').outcome).toBe('network-error')
    expect(plan('register-offline', 'ranking').outcome).toBe('answer')
  })
})

describe('isScenarioId', () => {
  it('accepts every listed scenario and nothing else', () => {
    expect(SCENARIO_IDS.every(isScenarioId)).toBe(true)
    expect(isScenarioId('chaos')).toBe(false)
    expect(isScenarioId(undefined)).toBe(false)
  })
})
