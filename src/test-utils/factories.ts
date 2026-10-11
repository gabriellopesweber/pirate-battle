import type { MatchConfig, MatchRecord } from '@/api/contracts'

/** Test data builders. Each call returns a fresh object; pass only what the test is about. */

export const DEFAULT_TEST_CONFIG: MatchConfig = { sessionSeconds: 120, spawnIntervalSeconds: 3 }

let sequence = 0

export function makeMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  sequence += 1
  return {
    matchId: `match-${String(sequence).padStart(4, '0')}`,
    playerId: 'player-1',
    playerName: 'Player One',
    endedAt: '2026-10-01T12:00:00.000Z',
    score: 5,
    durationSeconds: 120,
    endReason: 'time-up',
    config: { ...DEFAULT_TEST_CONFIG },
    ...overrides,
  }
}
