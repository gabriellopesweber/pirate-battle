import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createQueryClient } from '@/api/queryClient'

/**
 * Renders under the app's own query client defaults, without the wait
 * between retries. Pass `client` to share a cache between renders (a tab
 * closed and opened again).
 */
export function renderWithQuery(ui: ReactElement, client: QueryClient = createQueryClient({ retryDelay: 0 })) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}
