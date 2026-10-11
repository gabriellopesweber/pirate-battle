import { QueryClient } from '@tanstack/react-query'
import { isRetryable } from '@/api/apiError'

/** Two retries after the first failure: three attempts in all. */
export const MAX_RETRIES = 2

interface QueryClientOptions {
  /** Milliseconds between retries; the default is TanStack Query's exponential backoff. */
  retryDelay?: number
}

export function createQueryClient({ retryDelay }: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
        ...(retryDelay === undefined ? {} : { retryDelay }),
        // Fresh for 30 s: switching pages back and forth reuses the cache;
        // reopening a tab refetches regardless (see queries.ts).
        staleTime: 30_000,
      },
    },
  })
}
