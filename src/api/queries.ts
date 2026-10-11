import { keepPreviousData, queryOptions, replaceEqualDeep, useQuery } from '@tanstack/react-query'
import { ContractError } from '@/api/apiError'
import {
  isMatchRecord,
  isPage,
  isRankingEntry,
  type MatchConfig,
  type Page,
  PAGE_SIZE,
} from '@/api/contracts'
import { type ScoresRepository, scoresRepository } from '@/api/scoresRepository'

/**
 * Every score query lives under `scores`, so one invalidation refreshes both
 * tabs after a match is registered.
 */
export const scoreKeys = {
  all: ['scores'] as const,
  ranking: (config: MatchConfig, page: number) =>
    ['scores', 'ranking', config.sessionSeconds, config.spawnIntervalSeconds, page] as const,
  history: (playerId: string, page: number) => ['scores', 'history', playerId, page] as const,
}

function parsePage<T>(data: unknown, isItem: (item: unknown) => item is T): Page<T> {
  if (!isPage(data, isItem)) throw new ContractError()
  return data
}

/**
 * Structural sharing that refuses to go back in time. Each page carries the
 * revision it was read at; a response read before the cached one — a slow
 * request overtaken by a newer one — keeps the cached page instead of
 * overwriting it.
 */
export function keepNewestPage(oldData: unknown, newData: unknown): unknown {
  if (isRevisioned(oldData) && isRevisioned(newData) && newData.revision < oldData.revision) return oldData
  return replaceEqualDeep(oldData, newData)
}

const isRevisioned = (value: unknown): value is { revision: number } =>
  typeof value === 'object' && value !== null && typeof (value as { revision?: unknown }).revision === 'number'

// Shared by both queries: reopening a tab refetches even fresh data (the
// cached page shows meanwhile), and late responses never win.
const common = { structuralSharing: keepNewestPage, refetchOnMount: 'always' } as const

export const rankingQuery = (repository: ScoresRepository, config: MatchConfig, page: number) =>
  queryOptions({
    ...common,
    queryKey: scoreKeys.ranking(config, page),
    queryFn: async ({ signal }) =>
      parsePage((await repository.getRanking(config, { page, pageSize: PAGE_SIZE }, signal)).data, isRankingEntry),
  })

export const historyQuery = (repository: ScoresRepository, playerId: string, page: number) =>
  queryOptions({
    ...common,
    queryKey: scoreKeys.history(playerId, page),
    queryFn: async ({ signal }) =>
      parsePage((await repository.getHistory(playerId, { page, pageSize: PAGE_SIZE }, signal)).data, isMatchRecord),
  })

/** While another page loads, the previous one stays on screen. */
export function useRanking(config: MatchConfig, page: number) {
  return useQuery({ ...rankingQuery(scoresRepository, config, page), placeholderData: keepPreviousData })
}

export function useHistory(playerId: string, page: number) {
  return useQuery({ ...historyQuery(scoresRepository, playerId, page), placeholderData: keepPreviousData })
}
