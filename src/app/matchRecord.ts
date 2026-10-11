import type { MatchRecord } from '@/api/contracts'
import { optionsFromConfig } from '@/game/config/options'
import type { MatchResult } from '@/game/match/match'
import type { Player } from '@/storage/player'

/**
 * The record a completed match is registered as. The match id is generated
 * here, on the client, once per match: every later send of the same match —
 * retry, Try again, recovery after a refresh — carries it, which is what
 * lets the server recognise a resend.
 */
export function toMatchRecord(
  result: MatchResult,
  player: Player,
  endedAt: Date,
  matchId: string = crypto.randomUUID(),
): MatchRecord {
  return {
    matchId,
    playerId: player.id,
    playerName: player.name,
    endedAt: endedAt.toISOString(),
    score: result.score,
    durationSeconds: result.durationSeconds,
    endReason: result.reason,
    // The snapshot the match ran with, not the options saved now.
    config: optionsFromConfig(result.config),
  }
}
