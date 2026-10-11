import { AxiosError } from 'axios'

/** A response arrived but does not match the contract — e.g. an HTML page instead of JSON. */
export class ContractError extends Error {
  constructor() {
    super('The response does not match the API contract.')
    this.name = 'ContractError'
  }
}

const isTimeout = (error: AxiosError) =>
  error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT

/**
 * Whether a second try may succeed: timeouts, lost connections and 5xx may
 * be transient; a 4xx or a broken contract will fail the same way again, and
 * a request the app cancelled is not a failure at all.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof AxiosError) || error.code === AxiosError.ERR_CANCELED) return false
  const status = error.response?.status
  return status === undefined ? true : status >= 500
}

/** A short message for the player; the technical detail stays in the error. */
export function describeApiError(error: unknown): string {
  if (error instanceof ContractError) return 'The server sent an unexpected answer.'
  if (!(error instanceof AxiosError)) return 'Something went wrong.'
  if (isTimeout(error)) return 'The server took too long to answer.'
  const status = error.response?.status
  if (status === undefined) return 'Could not reach the server.'
  return status >= 500 ? 'The server ran into a problem.' : 'The server rejected the request.'
}
