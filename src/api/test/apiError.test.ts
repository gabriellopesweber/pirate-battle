import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { ContractError, describeApiError, isRetryable } from '@/api/apiError'

const withStatus = (status: number) =>
  new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, undefined, {}, { status } as AxiosResponse)

const timeout = () => new AxiosError('timeout of 5000ms exceeded', AxiosError.ECONNABORTED, undefined, {})
const offline = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK, undefined, {})

describe('isRetryable', () => {
  it('retries what may pass on a second try: timeouts, lost connections and server errors', () => {
    expect(isRetryable(timeout())).toBe(true)
    expect(isRetryable(offline())).toBe(true)
    expect(isRetryable(withStatus(503))).toBe(true)
  })

  it('does not retry what will fail the same way again: rejected requests and broken contracts', () => {
    expect(isRetryable(withStatus(400))).toBe(false)
    expect(isRetryable(withStatus(404))).toBe(false)
    expect(isRetryable(new ContractError())).toBe(false)
  })

  it('does not retry a request the app cancelled itself', () => {
    expect(isRetryable(new AxiosError('canceled', AxiosError.ERR_CANCELED))).toBe(false)
  })
})

describe('describeApiError', () => {
  it('names each kind of failure in words a player understands', () => {
    expect(describeApiError(timeout())).toBe('The server took too long to answer.')
    expect(describeApiError(offline())).toBe('Could not reach the server.')
    expect(describeApiError(withStatus(500))).toBe('The server ran into a problem.')
    expect(describeApiError(withStatus(400))).toBe('The server rejected the request.')
    expect(describeApiError(new ContractError())).toBe('The server sent an unexpected answer.')
  })

  it('falls back to a generic message for anything else', () => {
    expect(describeApiError(new Error('boom'))).toBe('Something went wrong.')
  })
})
