import type { NetworkSettingsStore } from '@/mocks/networkSettings'

/**
 * What the page can do to the running mock API: pick the network scenario and
 * reset the data. Null when the mock API did not start — the controls are
 * then hidden, since there is nothing to control.
 */
export interface MockControls {
  settings: NetworkSettingsStore
  /** Back to the fixtures and the success scenario, with no confirmed, pending or last result. */
  reset: () => void
}

let controls: MockControls | null = null

export function setMockControls(next: MockControls | null): void {
  controls = next
}

export function getMockControls(): MockControls | null {
  return controls
}
