import type { GameSession } from '@/render/GameSession'
import { type MatchSnapshot, snapshotMatch } from '@/testing/snapshot'
import { testOptions } from '@/testing/testOptions'

/**
 * What a browser test can reach, as `window.__pirateBattle`: the state of the
 * match on screen, and — with a manual clock — the simulation's time. Input
 * is not here on purpose: tests drive the game through its real keyboard and
 * touch controls.
 */
export interface TestHarness {
  /** The match on screen, or null when no match is showing. */
  state: () => MatchSnapshot | null
  /** Advances the match by whole simulation steps covering `seconds`. */
  step: (seconds: number) => void
}

declare global {
  interface Window {
    __pirateBattle?: TestHarness
  }
}

let current: GameSession | null = null

/** Called by the game view: the session tests observe and step. */
export function attachSession(session: GameSession): void {
  if (testOptions.enabled) current = session
}

export function detachSession(session: GameSession): void {
  if (current === session) current = null
}

export function installTestHarness(): void {
  if (!testOptions.enabled) return
  window.__pirateBattle = {
    state: () => (current ? snapshotMatch(current.match) : null),
    step: (seconds) => {
      if (!current) throw new Error('No match is showing')
      current.advanceSteps(Math.round(seconds / current.match.world.config.simulation.stepSeconds))
    },
  }
}
