import { describe, expect, it } from 'vitest'
import { isMatchRecord, PAGE_SIZE } from '@/api/contracts'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { optionsFromConfig } from '@/game/config/options'
import { createFixtureMatches } from '@/mocks/fixtures'
import { rankMatches } from '@/mocks/ranking'

describe('createFixtureMatches', () => {
  it('builds the same matches every time', () => {
    expect(createFixtureMatches()).toEqual(createFixtureMatches())
  })

  it('builds only valid records with unique match ids', () => {
    const matches = createFixtureMatches()

    expect(matches.every(isMatchRecord)).toBe(true)
    expect(new Set(matches.map((match) => match.matchId)).size).toBe(matches.length)
  })

  it('fills more than one ranking page for the default options', () => {
    const ranking = rankMatches(createFixtureMatches(), optionsFromConfig(DEFAULT_GAME_CONFIG))

    expect(ranking.length).toBeGreaterThan(PAGE_SIZE * 2)
  })

  it('represents several other players', () => {
    const players = new Set(createFixtureMatches().map((match) => match.playerId))

    expect(players.size).toBeGreaterThan(3)
  })
})
