import { isMatchRecord, type MatchConfig, type MatchRecord, type Page, type PageQuery, type RankingEntry } from '@/api/contracts'
import { historyOf, paginate, rankMatches } from '@/mocks/ranking'
import { readJson, writeJson } from '@/storage/local'

/**
 * The mock API's data: confirmed matches in Web Storage, so they survive a
 * refresh. One implementation serves development, the tests and the deployed
 * build — only the storage and the seed change.
 */
export interface MockDb {
  ranking(config: MatchConfig, query: PageQuery): Page<RankingEntry>
  history(playerId: string, query: PageQuery): Page<MatchRecord>
  /** The current data revision; every page read now carries it. */
  revision(): number
  /**
   * Stores a match once. Registering a match id again returns the stored
   * record untouched (`created: false`) — a resend after a lost response
   * recovers the original instead of duplicating it.
   */
  register(record: MatchRecord): { record: MatchRecord; created: boolean }
  /** Back to the seed, discarding every registered match. */
  reset(): void
}

export interface MockDbOptions {
  storage: () => Storage
  key: string
  /** The matches of other players the db starts with. */
  seed: () => MatchRecord[]
}

interface DbState {
  revision: number
  matches: MatchRecord[]
}

const isDbState = (value: unknown): value is DbState =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as DbState).revision) &&
  Array.isArray((value as DbState).matches) &&
  (value as DbState).matches.every(isMatchRecord)

export function createMockDb({ storage, key, seed }: MockDbOptions): MockDb {
  const fresh = (): DbState => ({ revision: 1, matches: seed() })

  // Read once; from then on memory is authoritative and every change is
  // written through. If storage is blocked the db still works, unpersisted.
  let state = readJson(storage, key, isDbState) ?? fresh()

  const commit = (next: DbState) => {
    state = next
    writeJson(storage, key, state)
  }

  return {
    ranking: (config, query) => paginate(rankMatches(state.matches, config), query, state.revision),
    history: (playerId, query) => paginate(historyOf(state.matches, playerId), query, state.revision),
    revision: () => state.revision,
    register(record) {
      const existing = state.matches.find((match) => match.matchId === record.matchId)
      if (existing) return { record: existing, created: false }
      commit({ revision: state.revision + 1, matches: [...state.matches, record] })
      return { record, created: true }
    },
    reset() {
      // The revision keeps rising: a client still holding pages from before
      // the reset must see the new ones as newer.
      commit({ revision: state.revision + 1, matches: seed() })
    },
  }
}
