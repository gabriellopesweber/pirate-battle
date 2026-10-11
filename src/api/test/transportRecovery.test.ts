import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContractError } from '@/api/apiError'
import { setTransportRecovery, withTransportRecovery } from '@/api/transportRecovery'

afterEach(() => {
  setTransportRecovery(null)
})

const failingOnce = <T>(value: T, error: Error = new ContractError()) => {
  let calls = 0
  return vi.fn(() => {
    calls += 1
    return calls === 1 ? Promise.reject(error) : Promise.resolve(value)
  })
}

describe('withTransportRecovery', () => {
  it('passes a successful answer through without recovering', async () => {
    const recover = vi.fn(() => Promise.resolve())
    setTransportRecovery(recover)

    expect(await withTransportRecovery(() => Promise.resolve('data'))).toBe('data')
    expect(recover).not.toHaveBeenCalled()
  })

  it('recovers the transport once and retries when an answer breaks the contract', async () => {
    const recover = vi.fn(() => Promise.resolve())
    setTransportRecovery(recover)
    const request = failingOnce('data')

    expect(await withTransportRecovery(request)).toBe('data')
    expect(recover).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('gives up after one recovery, so a broken transport never loops', async () => {
    setTransportRecovery(() => Promise.resolve())
    const request = vi.fn(() => Promise.reject(new ContractError()))

    await expect(withTransportRecovery(request)).rejects.toBeInstanceOf(ContractError)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('leaves other failures to the retry policy', async () => {
    const recover = vi.fn(() => Promise.resolve())
    setTransportRecovery(recover)
    const request = failingOnce('data', new Error('timeout'))

    await expect(withTransportRecovery(request)).rejects.toThrow('timeout')
    expect(recover).not.toHaveBeenCalled()
  })

  it('reports the broken contract when no recovery is registered', async () => {
    await expect(withTransportRecovery(failingOnce('data'))).rejects.toBeInstanceOf(ContractError)
  })
})
