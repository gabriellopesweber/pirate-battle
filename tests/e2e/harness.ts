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
  /** A network scenario for the mock API (src/mocks/scenarios.ts). */
  scenario?: string
}

/** Opens the game with a manual clock and a fixed seed, sets the options, and starts a match. */
export async function startTestMatch(page: Page, options: TestMatchOptions = {}): Promise<MatchSnapshot> {
  const { seed = 1, sessionSeconds = 120, spawnIntervalSeconds = 3, scenario } = options
  const network = scenario ? `&scenario=${scenario}` : ''
  await page.goto(`/?test&clock=manual&matchSeed=${String(seed)}${network}`)
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

/**
 * Holds `codes` for `seconds` of game time and samples the state every
 * `every` seconds — inside the page, in one round trip; stops early once the
 * match ends. The key events go to
 * the same window listener the keyboard feeds. On a slow runner a round trip
 * per sample outran the test's time limit.
 */
export function sampleWhileHolding(
  page: Page,
  codes: string[],
  seconds: number,
  every: number,
): Promise<MatchSnapshot[]> {
  return page.evaluate(
    ({ codes, seconds, every }) => {
      const game = (window as unknown as WithHarness).__pirateBattle
      for (const code of codes) window.dispatchEvent(new KeyboardEvent('keydown', { code }))
      const samples: MatchSnapshot[] = []
      for (let t = 0; t < seconds - 1e-9; t += every) {
        game.step(every)
        const now = game.state()
        if (!now) break
        samples.push(now)
        if (now.status === 'ended') break
      }
      for (const code of codes) window.dispatchEvent(new KeyboardEvent('keyup', { code }))
      return samples
    },
    { codes, seconds, every },
  )
}

/**
 * Chases one enemy with the real controls until it sinks or `maxSeconds` pass:
 * every 0.2 s of game time, turn toward it and hold the bow cannon. Runs
 * inside the page in one round trip, like `sampleWhileHolding`. Returns the
 * enemy's health at each decision, and whether it was sunk.
 */
export function engage(
  page: Page,
  enemyId: number,
  maxSeconds: number,
): Promise<{ healthSeen: number[]; sunk: boolean }> {
  return page.evaluate(
    ({ enemyId, maxSeconds }) => {
      const game = (window as unknown as WithHarness).__pirateBattle
      const key = (type: 'keydown' | 'keyup', code: string) => {
        window.dispatchEvent(new KeyboardEvent(type, { code }))
      }
      const healthSeen: number[] = []
      for (let t = 0; t < maxSeconds; t += 0.2) {
        const now = game.state()
        const enemy = now?.enemies.find((e) => e.id === enemyId)
        if (!now || !enemy) return { healthSeen, sunk: now !== null }
        healthSeen.push(enemy.health)
        const { position, heading } = now.player
        const wanted = Math.atan2(enemy.position.y - position.y, enemy.position.x - position.x)
        const delta = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading))
        const turnKey = Math.abs(delta) < 0.05 ? null : delta > 0 ? 'KeyD' : 'KeyA'
        if (turnKey) key('keydown', turnKey)
        key('keydown', 'Space')
        game.step(0.2)
        if (turnKey) key('keyup', turnKey)
        key('keyup', 'Space')
      }
      return { healthSeen, sunk: false }
    },
    { enemyId, maxSeconds },
  )
}