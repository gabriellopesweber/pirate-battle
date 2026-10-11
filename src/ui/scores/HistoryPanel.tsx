import { useState } from 'react'
import { useHistory } from '@/api/queries'
import { END_REASON_LABEL, formatClock, formatDate } from '@/ui/format'
import { PagedScores } from '@/ui/scores/PagedScores'

interface HistoryPanelProps {
  playerId: string
}

export function HistoryPanel({ playerId }: HistoryPanelProps) {
  const [page, setPage] = useState(1)
  const query = useHistory(playerId, page)

  return (
    <PagedScores
      query={query}
      noun="match history"
      empty="No matches yet. Play one to start your history."
      onPageChange={setPage}
    >
      {(matches) => (
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Score</th>
              <th scope="col">Duration</th>
              <th scope="col">Ended by</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.matchId}>
                <td>{formatDate(match.endedAt)}</td>
                <td>{match.score}</td>
                <td>{formatClock(match.durationSeconds)}</td>
                <td>{END_REASON_LABEL[match.endReason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PagedScores>
  )
}
