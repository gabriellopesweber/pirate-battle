import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '@/api/queryClient'
import { App } from '@/app/App'
import { installTestHarness } from '@/testing/harness'
import '@/styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

const queryClient = createQueryClient()

// Browser-test hooks; does nothing unless the URL has ?test.
installTestHarness()

/**
 * The mock API must be listening before the first request. If it cannot
 * start (no service worker support, private mode), the game still runs: only
 * the ranking and history tabs show their error state.
 */
async function startMockApi(): Promise<void> {
  try {
    const { startMockApi: start } = await import('@/mocks/browser')
    await start()
  } catch (error) {
    console.warn('The mock ranking and history API could not start.', error)
  }
}

void startMockApi().then(() => {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
