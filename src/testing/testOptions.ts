/**
 * Browser-test instrumentation, switched on by the URL and off otherwise:
 *
 *   ?test               exposes `window.__pirateBattle` (state and clock)
 *   &clock=manual       real time no longer moves a match; only the test steps it
 *   &matchSeed=7        every match starts from this seed
 *
 * Without `?test` none of it applies, so a player never meets it.
 */
export interface TestOptions {
  enabled: boolean
  manualClock: boolean
  matchSeed: number | null
}

export function testOptionsFromUrl(search: string): TestOptions {
  const params = new URLSearchParams(search)
  if (!params.has('test')) return { enabled: false, manualClock: false, matchSeed: null }
  const seed = Number(params.get('matchSeed') ?? Number.NaN)
  return {
    enabled: true,
    manualClock: params.get('clock') === 'manual',
    matchSeed: Number.isInteger(seed) ? seed : null,
  }
}

/** This page's options, read once at start-up. */
export const testOptions: TestOptions =
  typeof window === 'undefined'
    ? { enabled: false, manualClock: false, matchSeed: null }
    : testOptionsFromUrl(window.location.search)
