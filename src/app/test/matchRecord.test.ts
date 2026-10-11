import { describe, expect, it } from 'vitest'
import { isMatchRecord } from '@/api/contracts'
import { toMatchRecord } from '@/app/matchRecord'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { createMatchConfig } from '@/game/config/options'
import type { MatchResult } from '@/game/match/match'

const player = { id: 'player-1', name: 'Captain BEEF' }

const result = (overrides: Partial<MatchResult> = {}): MatchResult => ({
  score: 4,
  durationSeconds: 75.25,
  reason: 'destroyed',
  seed: 1,
  config: createMatchConfig(DEFAULT_GAME_CONFIG, { sessionSeconds: 90, spawnIntervalSeconds: 2.5 }),
  ...overrides,
})

const at = new Date('2026-10-11T15:00:00.000Z')

describe('toMatchRecord', () => {
  it('records the result with the player, the end date and the options the match ran with', () => {
    const record = toMatchRecord(result(), player, at, 'match-1')

    expect(record).toEqual({
      matchId: 'match-1',
      playerId: 'player-1',
      playerName: 'Captain BEEF',
      endedAt: '2026-10-11T15:00:00.000Z',
      score: 4,
      durationSeconds: 75.25,
      endReason: 'destroyed',
      config: { sessionSeconds: 90, spawnIntervalSeconds: 2.5 },
    })
  })

  it('builds a record the API contract accepts', () => {
    expect(isMatchRecord(toMatchRecord(result(), player, at, 'match-1'))).toBe(true)
  })

  it('gives every match its own id by default', () => {
    const first = toMatchRecord(result(), player, at)
    const second = toMatchRecord(result(), player, at)

    expect(first.matchId).not.toBe(second.matchId)
  })
})
