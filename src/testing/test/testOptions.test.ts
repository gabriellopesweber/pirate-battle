import { describe, expect, it } from 'vitest'
import { testOptionsFromUrl } from '@/testing/testOptions'

describe('testOptionsFromUrl', () => {
  it('leaves the game untouched without ?test', () => {
    expect(testOptionsFromUrl('')).toEqual({ enabled: false, manualClock: false, matchSeed: null })
    expect(testOptionsFromUrl('?clock=manual&matchSeed=7')).toEqual({
      enabled: false,
      manualClock: false,
      matchSeed: null,
    })
  })

  it('exposes the hooks with ?test, on real time and random seeds by default', () => {
    expect(testOptionsFromUrl('?test')).toEqual({ enabled: true, manualClock: false, matchSeed: null })
  })

  it('hands the clock to the test and fixes the seed when asked', () => {
    expect(testOptionsFromUrl('?test&clock=manual&matchSeed=7')).toEqual({
      enabled: true,
      manualClock: true,
      matchSeed: 7,
    })
  })

  it('ignores a seed that is not a whole number', () => {
    expect(testOptionsFromUrl('?test&matchSeed=abc').matchSeed).toBeNull()
  })
})
