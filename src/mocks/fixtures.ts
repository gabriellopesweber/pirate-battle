import type { MatchConfig, MatchRecord } from '@/api/contracts'
import { DEFAULT_GAME_CONFIG } from '@/game/config/gameConfig'
import { optionsFromConfig } from '@/game/config/options'
import { createRng } from '@/game/core/rng'

/**
 * Other players' matches, so the ranking has competition. Generated from a
 * fixed seed and fixed dates: every run, test and deploy sees the same data.
 */

const PLAYERS = [
  { id: 'fixture-anne-bonny', name: 'Anne Bonny' },
  { id: 'fixture-calico-jack', name: 'Calico Jack' },
  { id: 'fixture-mary-read', name: 'Mary Read' },
  { id: 'fixture-black-bart', name: 'Black Bart' },
  { id: 'fixture-grace-omalley', name: "Grace O'Malley" },
  { id: 'fixture-henry-every', name: 'Henry Every' },
  { id: 'fixture-ching-shih', name: 'Ching Shih' },
  { id: 'fixture-edward-low', name: 'Edward Low' },
] as const

/** How many matches each config gets: the default fills several pages, others fewer. */
const GROUPS: readonly { config: MatchConfig; count: number }[] = [
  { config: optionsFromConfig(DEFAULT_GAME_CONFIG), count: 18 },
  { config: { sessionSeconds: 60, spawnIntervalSeconds: 3 }, count: 6 },
  { config: { sessionSeconds: 180, spawnIntervalSeconds: 2 }, count: 4 },
]

const SEED = 0x5eed
const FIRST_DATE = Date.parse('2026-09-20T18:00:00.000Z')
const HOUR = 3_600_000

export function createFixtureMatches(): MatchRecord[] {
  const rng = createRng(SEED)
  const matches: MatchRecord[] = []

  for (const { config, count } of GROUPS) {
    // Roughly what a good player sinks: one enemy every two spawns.
    const bestScore = Math.round(config.sessionSeconds / config.spawnIntervalSeconds / 2)
    for (let i = 0; i < count; i++) {
      const player = PLAYERS[rng.int(0, PLAYERS.length - 1)] ?? PLAYERS[0]
      const sunk = rng.next() < 0.3
      const durationSeconds = sunk ? rng.int(20, config.sessionSeconds - 5) : config.sessionSeconds
      const score = rng.int(0, Math.round((bestScore * durationSeconds) / config.sessionSeconds))
      matches.push({
        matchId: `fixture-${String(matches.length + 1).padStart(3, '0')}`,
        playerId: player.id,
        playerName: player.name,
        endedAt: new Date(FIRST_DATE + matches.length * 7 * HOUR).toISOString(),
        score,
        durationSeconds,
        endReason: sunk ? 'destroyed' : 'time-up',
        config,
      })
    }
  }
  return matches
}
