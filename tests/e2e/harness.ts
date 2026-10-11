import { expect, type Page } from '@playwright/test'
import type { MatchSnapshot } from '../../src/testing/snapshot'

/**
 * Drives a match through the test instrumentation (`?test`, see
 * src/testing/testOptions.ts): the clock is manual and the seed fixed, so a
 * match replays exactly. Tests observe state and step time; they act only
 * through the game's real controls — the keyboard here.
 */

export interface Harness {
  state: () => MatchSnapshot | null
  step: (seconds: number) => void
}

// page.evaluate ships its callback to the browser as source text, so each one
// reaches the hooks itself — a helper closure would not exist there.
type WithHarness = { __pirateBattle: Harness }

export interface TestMatchOptions {
  seed?: number
  sessionSeconds?: number
  spawnIntervalSeconds?: number
}

/** Opens the game with a manual clock and a fixed seed, sets the options, and starts a match. */
export async function startTestMatch(page: Page, options: TestMatchOptions = {}): Promise<MatchSnapshot> {
  const { seed = 1, sessionSeconds = 120, spawnIntervalSeconds = 3 } = options
  await page.goto(`/?test&clock=manual&matchSeed=${String(seed)}`)
  await page.evaluate(
    (saved) => {
      localStorage.setItem('pirate-battle:options', JSON.stringify(saved))
    },
    { sessionSeconds, spawnIntervalSeconds },
  )
  await page.reload()
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 15_000 })
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => state(page)).not.toBeNull()
  return requireState(page)
}

export function state(page: Page): Promise<MatchSnapshot | null> {
  return page.evaluate(() => (window as unknown as WithHarness).__pirateBattle.state())
}

export async function requireState(page: Page): Promise<MatchSnapshot> {
  const snapshot = await state(page)
  if (!snapshot) throw new Error('No match is showing')
  return snapshot
}

/** Advances the simulation by `seconds` of game time. */
export async function step(page: Page, seconds: number): Promise<MatchSnapshot | null> {
  await page.evaluate((s) => {
    ;(window as unknown as WithHarness).__pirateBattle.step(s)
  }, seconds)
  return state(page)
}

/** Holds a game key for `seconds` of game time, then releases it. */
export async function hold(page: Page, code: string, seconds: number): Promise<MatchSnapshot | null> {
  await page.keyboard.down(code)
  const after = await step(page, seconds)
  await page.keyboard.up(code)
  return after
}

export const STEP_SECONDS = 1 / 60

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

/** Signed difference between two angles, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (2 * Math.PI)
  if (delta > Math.PI) delta -= 2 * Math.PI
  if (delta <= -Math.PI) delta += 2 * Math.PI
  return delta
}

/** The player's turn rate, rad/s (src/game/config/gameConfig.ts). */
const TURN_SPEED = 2.6

/**
 * Turns the ship with the real turn keys until it faces `target`: each pass
 * holds the key for as long as the remaining angle takes, a few passes at
 * most. Returns the last snapshot.
 */
export async function aimAt(page: Page, target: { x: number; y: number }, tolerance = 0.03) {
  let current = await requireState(page)
  for (let pass = 0; pass < 6; pass++) {
    const { position, heading } = current.player
    const wanted = Math.atan2(target.y - position.y, target.x - position.x)
    const delta = angleDelta(heading, wanted)
    if (Math.abs(delta) <= tolerance) return current
    const seconds = Math.max(STEP_SECONDS, Math.round(Math.abs(delta) / TURN_SPEED / STEP_SECONDS) * STEP_SECONDS)
    current = (await hold(page, delta > 0 ? 'KeyD' : 'KeyA', seconds)) ?? current
  }
  throw new Error('Could not aim at the target')
}