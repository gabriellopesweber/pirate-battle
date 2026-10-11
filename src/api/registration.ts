import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ContractError } from '@/api/apiError'
import { isMatchRecord, type MatchRecord } from '@/api/contracts'
import { scoreKeys } from '@/api/queries'
import { type ScoresRepository, scoresRepository } from '@/api/scoresRepository'
import { pendingMatches } from '@/storage/pendingMatches'

/**
 * Registering a completed match. The match enters the pending queue before it
 * is sent and leaves it only on a confirmed answer; the server keys matches
 * by id, so every send — retry, Try again, recovery after a refresh — is safe
 * to repeat and never duplicates.
 */

export const registrationKey = ['register-match'] as const

async function postMatch(repository: ScoresRepository, record: MatchRecord): Promise<MatchRecord> {
  const { data } = await repository.registerMatch(record)
  if (!isMatchRecord(data)) throw new ContractError()
  return data
}

/** Sends a match; on success it leaves the queue and both score tabs refresh. */
export function useRegisterMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: registrationKey,
    mutationFn: (record: MatchRecord) => postMatch(scoresRepository, record),
    onSuccess: async (saved) => {
      pendingMatches.remove(saved.matchId)
      await queryClient.invalidateQueries({ queryKey: scoreKeys.all })
    },
  })
}

/** Sends every pending registration once when the app starts — the recovery after a refresh. */
export function useRecoverPendingRegistrations() {
  const { mutate } = useRegisterMatch()
  // Strict Mode mounts twice but keeps refs: this guards against sending twice.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    for (const record of pendingMatches.list()) mutate(record)
  }, [mutate])
}

export type RegistrationState =
  | { status: 'saved' }
  | { status: 'sending' }
  | { status: 'pending' }
  | { status: 'failed'; error: unknown }

/** Where one match's registration stands, from the queue and the latest send. */
export function useRegistrationState(matchId: string): RegistrationState {
  const pending = useSyncExternalStore(pendingMatches.subscribe, () => pendingMatches.has(matchId))
  const sends = useMutationState({
    filters: {
      mutationKey: registrationKey,
      predicate: (mutation) => (mutation.state.variables as MatchRecord | undefined)?.matchId === matchId,
    },
    select: (mutation) => ({ status: mutation.state.status, error: mutation.state.error }),
  })
  const latest = sends.at(-1)

  if (latest?.status === 'pending') return { status: 'sending' }
  if (!pending) return { status: 'saved' }
  if (latest?.status === 'error') return { status: 'failed', error: latest.error }
  return { status: 'pending' }
}
