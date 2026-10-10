import type { EndReason } from '@/game/match/match'
import { local, readJson, writeJson } from '@/storage/local'

/** What the result screen shows, kept so it survives a refresh. */
export interface StoredResult {
  score: number
  durationSeconds: number
  reason: EndReason
  /** ISO date the match ended. */
  endedAt: string
}

const KEY = 'pirate-battle:last-result'

const isStoredResult = (value: unknown): value is StoredResult => {
  if (typeof value !== 'object' || value === null) return false
  // Checked as an unknown record: the stored value may be anything.
  const r = value as Record<string, unknown>
  return (
    typeof r.score === 'number' &&
    typeof r.durationSeconds === 'number' &&
    (r.reason === 'time-up' || r.reason === 'destroyed') &&
    typeof r.endedAt === 'string'
  )
}

export function loadLastResult(): StoredResult | null {
  return readJson(local, KEY, isStoredResult)
}

export function saveLastResult(result: StoredResult): void {
  writeJson(local, KEY, result)
}
