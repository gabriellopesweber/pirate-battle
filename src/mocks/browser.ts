import { setupWorker } from 'msw/browser'
import { API_BASE_URL } from '@/api/http'
import { createMockDb } from '@/mocks/db'
import { createFixtureMatches } from '@/mocks/fixtures'
import { createHandlers } from '@/mocks/handlers'
import { local } from '@/storage/local'

/** Confirmed matches, kept across refreshes. */
export const MOCK_DB_KEY = 'pirate-battle:mock-db'

/**
 * Starts the mock ranking and history API in the browser — in development and
 * in the deployed build alike, since there is no real backend.
 */
export async function startMockApi() {
  const db = createMockDb({ storage: local, key: MOCK_DB_KEY, seed: createFixtureMatches })
  const worker = setupWorker(...createHandlers(db, new URL(API_BASE_URL, window.location.href).href))
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Game assets and the page itself go to the network untouched.
    onUnhandledFrame: 'bypass',
    quiet: import.meta.env.PROD,
  })
  return { db, worker }
}
