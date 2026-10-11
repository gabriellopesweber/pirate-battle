import type { AxiosInstance } from 'axios'
import type { MatchConfig, MatchRecord, PageQuery } from '@/api/contracts'
import { http } from '@/api/http'

/**
 * The map of the ranking and history endpoints — nothing else: no error
 * handling, no parsing, no state. Responses come back raw (`unknown` data);
 * the query layer validates them against the contracts.
 */
export function createScoresRepository(client: AxiosInstance) {
  return {
    getRanking: (config: MatchConfig, query: PageQuery, signal: AbortSignal) =>
      client.get<unknown>('/ranking', { params: { ...config, ...query }, signal }),

    getHistory: (playerId: string, query: PageQuery, signal: AbortSignal) =>
      client.get<unknown>(`/players/${encodeURIComponent(playerId)}/matches`, { params: query, signal }),

    registerMatch: (record: MatchRecord) => client.post<unknown>('/matches', record),
  }
}

export type ScoresRepository = ReturnType<typeof createScoresRepository>

export const scoresRepository = createScoresRepository(http)
