import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import type { MatchRecord } from '@/api/contracts'
import { API_BASE_URL } from '@/api/http'
import { createMockDb, type MockDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { MemoryStorage } from '@/test-utils/memoryStorage'

/**
 * For component tests (jsdom): the app's own client, unchanged, talks to the
 * real handlers and a fresh in-memory db per test. The base URL resolves
 * against jsdom's page URL, the way the browser resolves it.
 */
export function setupMockApiServer(seed: () => MatchRecord[]) {
  const server = setupServer()
  const apiBase = new URL(API_BASE_URL, window.location.href).href
  const state: { db: MockDb | null } = { db: null }

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' })
  })
  beforeEach(() => {
    state.db = createMockDb({ storage: () => new MemoryStorage(), key: 'test:db', seed })
    server.resetHandlers(...createHandlers(state.db, apiBase))
  })
  afterAll(() => {
    server.close()
  })

  return {
    server,
    /** This test's db, to act as the server would behind a handler override. */
    db: (): MockDb => {
      if (!state.db) throw new Error('The mock db exists only inside a test')
      return state.db
    },
    /** Absolute URL of an endpoint, for overriding it with `server.use`. */
    url: (path: string) => `${apiBase}${path}`,
  }
}
