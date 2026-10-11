import { expect, type Page, test } from '@playwright/test'
import { type Harness, hold, requireState, startTestMatch, state, step } from './harness'

// Flows 6, 7 and 8 of the brief: ending by time and by sinking with the
// simulation stopped, a clean restart, pause and focus loss without the
// clock advancing, and the result surviving a refresh.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'keyboard-driven; touch controls are covered in touch.spec and controls.spec')
})

const resultFacts = (page: Page) => page.locator('.result__facts')

/** Steps an idle match until it ends, a second at a time. */
async function stepUntilOver(page: Page, maxSeconds: number) {
  for (let s = 0; s < maxSeconds; s++) {
    const now = await step(page, 1)
    if (!now || now.status === 'ended') return
  }
  throw new Error(`still running after ${String(maxSeconds)} s`)
}

/**
 * Plays like a person for `seconds` of game time: every 0.2 s, turn toward the
 * nearest enemy with the turn keys and hold the bow cannon while one exists.
 * A player who does not fight back never lasts a 60 s match — the Chasers
 * always reach it — so the end by time has to be earned.
 *
 * The decisions run inside the page in one go: the key events go to the same
 * window listener the keyboard feeds, without a round trip per decision
 * (300 of them took longer than the test's time limit).
 */
async function fight(page: Page, seconds: number) {
  await page.evaluate((total) => {
    const game = (window as unknown as { __pirateBattle: Harness }).__pirateBattle
    const key = (type: 'keydown' | 'keyup', code: string) => {
      window.dispatchEvent(new KeyboardEvent(type, { code }))
    }
    for (let t = 0; t < total - 1e-9; t += 0.2) {
      const now = game.state()
      if (!now) return
      const { position, heading } = now.player
      let nearest: { x: number; y: number } | null = null
      let best = Number.POSITIVE_INFINITY
      for (const enemy of now.enemies) {
        const gap = Math.hypot(enemy.position.x - position.x, enemy.position.y - position.y)
        if (gap < best) {
          best = gap
          nearest = enemy.position
        }
      }
      const wanted = nearest ? Math.atan2(nearest.y - position.y, nearest.x - position.x) : heading
      const delta = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading))
      const turnKey = Math.abs(delta) < 0.05 ? null : delta > 0 ? 'KeyD' : 'KeyA'
      if (turnKey) key('keydown', turnKey)
      if (nearest) key('keydown', 'Space')
      game.step(0.2)
      if (turnKey) key('keyup', turnKey)
      key('keyup', 'Space')
    }
  }, seconds)
}

test('the match ends when time runs out, and the result shows what happened', async ({ page }) => {
  test.setTimeout(120_000)
  // Seed 10: fighting back as `fight` does, the ship lasts the whole match.
  await startTestMatch(page, { sessionSeconds: 60, spawnIntervalSeconds: 10, seed: 10 })

  await fight(page, 59.8)
  const almost = await requireState(page)
  expect(almost.status).toBe('running')
  expect(almost.timeLeft).toBeGreaterThan(0)

  await step(page, 0.4)

  await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible()
  await expect(resultFacts(page)).toContainText('1:00')
  await expect(resultFacts(page)).toContainText('Time up')
  // Leaving combat destroyed the session: nothing keeps simulating.
  expect(await state(page)).toBeNull()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('the match ends when the ship sinks', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 1 })

  await stepUntilOver(page, 120)

  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible()
  await expect(resultFacts(page)).toContainText('Ship sunk')
})

test('the result survives a refresh', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 1 })
  await stepUntilOver(page, 120)
  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible()
  const facts = await resultFacts(page).textContent()

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible({ timeout: 15_000 })
  expect(await resultFacts(page).textContent()).toBe(facts)
})

test('restarting starts a clean match', async ({ page }) => {
  const start = await startTestMatch(page, { spawnIntervalSeconds: 2 })
  await hold(page, 'KeyW', 2)
  await hold(page, 'Space', 0.5)
  const played = await step(page, 4)
  expect(played?.enemies.length).toBeGreaterThan(0)

  await page.keyboard.press('KeyR')
  await expect.poll(async () => (await state(page))?.time).toBe(0)

  const fresh = await requireState(page)
  expect(fresh).toMatchObject({ status: 'running', score: 0, spawned: 0, enemies: [], projectiles: [] })
  expect(fresh.player.position).toEqual(start.player.position)
  expect(fresh.player.health).toBe(fresh.player.maxHealth)
  expect(fresh.timeLeft).toBe(start.timeLeft)
})

test('pausing freezes the clock, cooldowns and enemies; resuming does not catch up', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 2 })
  await hold(page, 'Space', 1 / 60)
  const before = await step(page, 2.1)

  await page.keyboard.press('KeyP')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  const paused = await step(page, 5)

  expect(paused?.status).toBe('paused')
  expect(paused?.time).toBe(before?.time)
  expect(paused?.weapons).toEqual(before?.weapons)
  expect(paused?.enemies).toEqual(before?.enemies)

  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Resume' }).click()
  const resumed = await step(page, 1)
  expect(resumed?.status).toBe('running')
  expect((resumed?.time ?? 0) - (before?.time ?? 0)).toBeCloseTo(1, 5)
})

test('losing focus pauses the match and drops the keys held', async ({ page }) => {
  await startTestMatch(page)
  await page.keyboard.down('KeyW')
  await step(page, 1)

  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
  })
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  const atPause = await requireState(page)
  expect(atPause.status).toBe('paused')
  expect(atPause.player.speed).toBeGreaterThan(100)
  await page.keyboard.up('KeyW')

  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Resume' }).click()
  // W was held when focus went; after resuming the ship slows down instead of
  // thrusting on.
  const after = await step(page, 0.5)
  expect(after?.player.speed).toBeLessThan(atPause.player.speed)
})
