import { setupWorker } from 'msw/browser'
import { API_BASE_URL } from '@/api/http'
import { setTransportRecovery } from '@/api/transportRecovery'
import { createRng } from '@/game/core/rng'
import { setMockControls } from '@/mocks/controls'
import { createMockDb } from '@/mocks/db'
import { createFixtureMatches } from '@/mocks/fixtures'
import { createHandlers, MOCK_HEALTH_PATH } from '@/mocks/handlers'
import { createNetworkSettingsStore, DEFAULT_NETWORK, settingsFromUrl } from '@/mocks/networkSettings'
import { clearLastResult } from '@/storage/lastResult'
import { local } from '@/storage/local'
import { pendingMatches } from '@/storage/pendingMatches'

/** Confirmed matches, kept across refreshes. */
export const MOCK_DB_KEY = 'pirate-battle:mock-db'
/** The network scenario and seed, kept across refreshes. */
export const NETWORK_KEY = 'pirate-battle:network'

/**
 * Starts the mock ranking and history API in the browser — in development and
 * in the deployed build alike, since there is no real backend.
 */
export async function startMockApi() {
  const apiBase = new URL(API_BASE_URL, window.location.href).href.replace(/\/$/, '')
  const db = createMockDb({ storage: local, key: MOCK_DB_KEY, seed: createFixtureMatches })

  // The URL wins over what is kept, and is kept in turn, so a refresh replays it.
  const settings = createNetworkSettingsStore({ storage: local, key: NETWORK_KEY })
  settings.set(settingsFromUrl(window.location.search, settings.get()))
  let rng = createRng(settings.get().seed)
  let seed = settings.get().seed
  settings.subscribe(() => {
    if (settings.get().seed !== seed) {
      seed = settings.get().seed
      rng = createRng(seed)
    }
  })

  const worker = setupWorker(
    ...createHandlers(db, apiBase, { scenario: () => settings.get().scenario, rng: () => rng }),
  )
  const start = () =>
    worker.start({
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      // Game assets and the page itself go to the network untouched.
      onUnhandledFrame: 'bypass',
      quiet: import.meta.env.PROD,
    })

  await start()

  // The worker keeps the pages it serves in memory only. If that list
  // empties — the browser stopped the idle worker, or a reload's race made it
  // unregister itself — it passes every request through, and the API answers
  // with index.html (#42). When an answer breaks the contract, check whether
  // the worker still answers for this page and, if not, start it again.
  let recovering: Promise<void> | null = null
  const isAnswering = async () => {
    try {
      const response = await fetch(`${apiBase}${MOCK_HEALTH_PATH}`, { cache: 'no-store' })
      return response.headers.get('content-type')?.includes('application/json') === true
    } catch {
      return false
    }
  }
  setTransportRecovery(() => {
    recovering ??= (async () => {
      if (await isAnswering()) return
      await worker.stop()
      await start()
    })().finally(() => {
      recovering = null
    })
    return recovering
  })

  setMockControls({
    settings,
    reset() {
      db.reset()
      pendingMatches.clear()
      clearLastResult()
      settings.set(DEFAULT_NETWORK)
    },
  })

  return { db, worker }
}
