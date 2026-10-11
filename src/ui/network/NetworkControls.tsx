import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { scoreKeys } from '@/api/queries'
import { useRegisterMatch } from '@/api/registration'
import { getMockControls, type MockControls } from '@/mocks/controls'
import type { ScenarioId } from '@/mocks/scenarios'
import { pendingMatches } from '@/storage/pendingMatches'
import { NetworkPanel } from '@/ui/network/NetworkPanel'

/** The network panel wired to the running mock API; hidden when the mock API did not start. */
export function NetworkControls() {
  const controls = getMockControls()
  return controls ? <ConnectedPanel controls={controls} /> : null
}

function ConnectedPanel({ controls }: { controls: MockControls }) {
  const { settings } = controls
  const { scenario } = useSyncExternalStore(settings.subscribe, settings.get)
  const queryClient = useQueryClient()
  const { mutate } = useRegisterMatch()

  const change = (next: ScenarioId) => {
    settings.set({ ...settings.get(), scenario: next })
    // The tabs show the new conditions at once, and registrations left
    // pending by the previous scenario are sent again under the new one.
    void queryClient.invalidateQueries({ queryKey: scoreKeys.all })
    for (const record of pendingMatches.list()) mutate(record)
  }

  const reset = () => {
    controls.reset()
    // Reload without the query string: a `?scenario=` would select it again.
    window.location.assign(window.location.pathname)
  }

  return <NetworkPanel scenario={scenario} onChange={change} onReset={reset} />
}
