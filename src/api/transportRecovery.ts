import { ContractError } from '@/api/apiError'

/**
 * A way to repair the transport when an answer breaks the contract — in this
 * app, the mock API's service worker passing requests through to the network,
 * so the SPA's index.html comes back instead of JSON (#42). The API layer only
 * knows that a recovery may exist; the mock layer registers it.
 */
type Recovery = () => Promise<void>

let recovery: Recovery | null = null

export function setTransportRecovery(next: Recovery | null): void {
  recovery = next
}

/**
 * Runs a request. If its answer breaks the contract and a recovery is
 * registered, recovers once and tries again; a second broken answer is final,
 * so a transport that cannot be repaired never loops. Every other failure is
 * left to the retry policy.
 */
export async function withTransportRecovery<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (!(error instanceof ContractError) || !recovery) throw error
    await recovery()
    return request()
  }
}
