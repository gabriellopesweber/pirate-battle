import { describeApiError } from '@/api/apiError'
import { type RegistrationState, useRegisterMatch, useRegistrationState } from '@/api/registration'
import { pendingMatches } from '@/storage/pendingMatches'
import './registration.css'

interface RegistrationStatusProps {
  matchId: string
}

function describe(state: RegistrationState): string {
  switch (state.status) {
    case 'saved':
      return 'Saved'
    case 'sending':
      return 'Sending…'
    case 'pending':
      return 'Not sent yet'
    case 'failed':
      return `Not saved: ${describeApiError(state.error)}`
  }
}

/** The result screen's "match record" line: where the registration stands, and a retry. */
export function RegistrationStatus({ matchId }: RegistrationStatusProps) {
  const state = useRegistrationState(matchId)
  const { mutate } = useRegisterMatch()
  const canRetry = state.status === 'pending' || state.status === 'failed'

  const retry = () => {
    const record = pendingMatches.list().find((pending) => pending.matchId === matchId)
    if (record) mutate(record)
  }

  return (
    <span className="registration">
      <span role="status" className={`registration__status registration__status--${state.status}`}>
        {describe(state)}
      </span>
      {canRetry && (
        <button type="button" className="registration__retry" onClick={retry}>
          Try again
        </button>
      )}
    </span>
  )
}
