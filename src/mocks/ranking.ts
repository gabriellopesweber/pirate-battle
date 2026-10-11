import type { MatchConfig, MatchRecord, Page, PageQuery, RankingEntry } from '@/api/contracts'

/**
 * The server-side rules of the mock API, as pure functions over a list of
 * matches — the handlers only parse requests and call these.
 */
const sameConfig = (a: MatchConfig, b: MatchConfig) =>
  a.sessionSeconds === b.sessionSeconds && a.spawnIntervalSeconds === b.spawnIntervalSeconds

/**
 * Score, highest first. Ties go to the match that ended first — reaching a
 * score earlier is what holds the spot, as on an arcade board — and then to
 * the lower match id, so the order is total and never depends on insertion.
 */
function compareRanking(a: MatchRecord, b: MatchRecord): number {
  return b.score - a.score || Date.parse(a.endedAt) - Date.parse(b.endedAt) || compareText(a.matchId, b.matchId)
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** The ranking for one config: only matches played with it, ordered and numbered. */
export function rankMatches(matches: readonly MatchRecord[], config: MatchConfig): RankingEntry[] {
  return matches
    .filter((match) => sameConfig(match.config, config))
    .sort(compareRanking)
    .map((match, index) => ({ ...match, rank: index + 1 }))
}

/** One player's matches, most recent first. */
export function historyOf(matches: readonly MatchRecord[], playerId: string): MatchRecord[] {
  return matches
    .filter((match) => match.playerId === playerId)
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || compareText(a.matchId, b.matchId))
}

export function paginate<T>(items: readonly T[], { page, pageSize }: PageQuery, revision: number): Page<T> {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    revision,
  }
}
