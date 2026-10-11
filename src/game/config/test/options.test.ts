import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { createMatchConfig, OPTION_LIMITS, optionsFromConfig, validateOptions } from '@/game/config/options'

const valid = { sessionSeconds: 90, spawnIntervalSeconds: 2.5 }

describe('validateOptions', () => {
  it('accepts the defaults', () => {
    expect(validateOptions(optionsFromConfig(DEFAULT_GAME_CONFIG))).toEqual({})
  })

  it('accepts the documented limits inclusively', () => {
    const { sessionSeconds: s, spawnIntervalSeconds: i } = OPTION_LIMITS
    expect(validateOptions({ sessionSeconds: s.min, spawnIntervalSeconds: i.min })).toEqual({})
    expect(validateOptions({ sessionSeconds: s.max, spawnIntervalSeconds: i.max })).toEqual({})
  })

  it.each([
    [{ ...valid, sessionSeconds: 59 }, 'sessionSeconds'],
    [{ ...valid, sessionSeconds: 181 }, 'sessionSeconds'],
    [{ ...valid, spawnIntervalSeconds: 0 }, 'spawnIntervalSeconds'],
    [{ ...valid, spawnIntervalSeconds: -1 }, 'spawnIntervalSeconds'],
    [{ ...valid, spawnIntervalSeconds: Number.NaN }, 'spawnIntervalSeconds'],
  ])('rejects %o', (options, field) => {
    expect(Object.keys(validateOptions(options))).toEqual([field])
  })
})

describe('createMatchConfig', () => {
  it('applies the options on a copy and leaves the base untouched', () => {
    const config = createMatchConfig(DEFAULT_GAME_CONFIG, valid)

    expect(config.match.durationSeconds).toBe(90)
    expect(config.spawn.intervalSeconds).toBe(2.5)
    expect(DEFAULT_GAME_CONFIG.match.durationSeconds).toBe(120)
  })

  it('returns a deeply frozen snapshot', () => {
    const config = createMatchConfig(DEFAULT_GAME_CONFIG, valid)

    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.player.frontWeapon)).toBe(true)
  })

  it('refuses invalid options', () => {
    expect(() => createMatchConfig(DEFAULT_GAME_CONFIG, { ...valid, sessionSeconds: 10 })).toThrow()
  })
})
