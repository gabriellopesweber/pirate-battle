// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '@/api/queryClient'
import { useRecoverPendingRegistrations } from '@/api/registration'
import { pendingMatches } from '@/storage/pendingMatches'
import { makeMatch } from '@/test-utils/factories'
import { setupMockApiServer } from '@/test-utils/mockApiServer'

const api = setupMockApiServer(() => [])

const posts = { count: 0 }

beforeEach(() => {
  for (const record of pendingMatches.list()) pendingMatches.remove(record.matchId)
  posts.count = 0
  api.server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') posts.count += 1
  })
})

afterEach(() => {
  api.server.events.removeAllListeners()
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient({ retryDelay: 0 })}>{children}</QueryClientProvider>
}

// Strict Mode at the root runs mount effects twice, as the app does in
// development. A <StrictMode> inside the wrapper does not: measured, the
// effect ran once — so the option, not the element, is what this test needs.
const render = () => renderHook(useRecoverPendingRegistrations, { wrapper, reactStrictMode: true })

describe('useRecoverPendingRegistrations', () => {
  it('sends every pending registration once when the app starts, as after a refresh', async () => {
    pendingMatches.add(makeMatch({ matchId: 'a', playerId: 'me' }))
    pendingMatches.add(makeMatch({ matchId: 'b', playerId: 'me' }))

    render()

    await waitFor(() => {
      expect(pendingMatches.list()).toEqual([])
    })
    expect(posts.count).toBe(2)
    expect(api.db().history('me', { page: 1, pageSize: 5 }).totalItems).toBe(2)
  })

  it('does nothing when no registration is pending', async () => {
    render()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(posts.count).toBe(0)
  })
})
