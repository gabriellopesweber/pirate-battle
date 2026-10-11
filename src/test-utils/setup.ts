// Testing Library's waits (findBy*, waitFor) give up after 1 s by default. The
// first test of each jsdom file also pays for starting the environment, and on
// a loaded machine that alone ran past 1 s, failing unchanged code (#48).
// 5 s still fails a real hang quickly; Vitest's own per-test limit stays above
// it (vitest.config.ts).
//
// Only files that run in jsdom wait on the DOM, so only they load the
// library: the unit tests of pure rules skip the cost.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/dom')
  configure({ asyncUtilTimeout: 5_000 })
}
