import { QueryClient } from '@tanstack/react-query'
import { isRetryable } from '@/api/apiError'

/** Two retries after the first failure: three attempts in all. */
export const MAX_RETRIES = 2

interface QueryClientOptions {
  /** Milliseconds between retries; the default is TanStack Query's exponential backoff. */
  retryDelay?: number
}

const retry = (failureCount: number, error: unknown) => failureCount < MAX_RETRIES && isRetryable(error)

export function createQueryClient({ retryDelay }: QueryClientOptions = {}): QueryClient {
  const delay = retryDelay === undefined ? {} : { retryDelay }
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry,
        ...delay,
        // Fresh for 30 s: switching pages back and forth reuses the cache;
        // reopening a tab refetches regardless (see queries.ts).
        staleTime: 30_000,
      },
      // Registering a match is safe to repeat — the server keys it by match
      // id — so mutations retry under the same policy as reads.
      mutations: { retry, ...delay },
    },
  })
}
