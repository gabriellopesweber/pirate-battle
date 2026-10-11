import { useState } from 'react'
import type { MatchConfig } from '@/api/contracts'
import { useRanking } from '@/api/queries'
import { formatClock } from '@/ui/format'
import { PagedScores } from '@/ui/scores/PagedScores'

interface RankingPanelProps {
  /** The ranking compares matches played with this config — the player's saved options. */
  config: MatchConfig
  playerId: string
}

export function RankingPanel({ config, playerId }: RankingPanelProps) {
  const [page, setPage] = useState(1)
  const query = useRanking(config, page)

  return (
    <>
      <p className="scores__caption">
        {formatClock(config.sessionSeconds)} matches · enemy every {config.spawnIntervalSeconds} s
      </p>
      <PagedScores query={query} noun="ranking" empty="No matches with these settings yet." onPageChange={setPage}>
        {(entries) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Score</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const mine = entry.playerId === playerId
                return (
                  <tr key={entry.matchId} className={mine ? 'scores__mine' : undefined}>
                    <td>{entry.rank}</td>
                    <td>
                      {entry.playerName}
                      {mine && (
                        <>
                          {' '}
                          <span className="scores__you">(you)</span>
                        </>
                      )}
                    </td>
                    <td>{entry.score}</td>
                    <td>{formatClock(entry.durationSeconds)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </PagedScores>
    </>
  )
}
