import { isMatchRecord, type MatchRecord } from '@/api/contracts'
import { local, readJson, writeJson } from '@/storage/local'

/**
 * Completed matches whose registration the server has not confirmed yet.
 * A match enters before its first send and leaves only on a confirmed
 * response, so a failure, a timeout or a refresh in between never loses it.
 * Subscribable, so React can read it with useSyncExternalStore.
 */
export interface PendingStore {
  /** In the order the matches ended. Same array until something changes. */
  list(): readonly MatchRecord[]
  has(matchId: string): boolean
  add(record: MatchRecord): void
  remove(matchId: string): void
  subscribe(listener: () => void): () => void
}

interface PendingStoreOptions {
  storage: () => Storage
  key: string
}

const isQueue = (value: unknown): value is MatchRecord[] => Array.isArray(value) && value.every(isMatchRecord)

export function createPendingStore({ storage, key }: PendingStoreOptions): PendingStore {
  // Read once; memory is authoritative afterwards and every change is written
  // through, so a blocked storage only costs persistence.
  let records: readonly MatchRecord[] = readJson(storage, key, isQueue) ?? []
  const listeners = new Set<() => void>()

  const commit = (next: readonly MatchRecord[]) => {
    records = next
    writeJson(storage, key, records)
    for (const listener of listeners) listener()
  }

  const has = (matchId: string) => records.some((record) => record.matchId === matchId)

  return {
    list: () => records,
    has,
    add(record) {
      if (!has(record.matchId)) commit([...records, record])
    },
    remove(matchId) {
      if (has(matchId)) commit(records.filter((record) => record.matchId !== matchId))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const PENDING_MATCHES_KEY = 'pirate-battle:pending-matches'

/** The app's queue. */
export const pendingMatches = createPendingStore({ storage: local, key: PENDING_MATCHES_KEY })
