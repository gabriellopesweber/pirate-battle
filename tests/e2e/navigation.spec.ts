import { expect, type Page, test } from '@playwright/test'
import { requireState, sampleWhileHolding, startTestMatch, state, step } from './harness'

// Flow 9 of the brief: repeated navigation between screens. Round after round
// — options, a match left from the pause menu, a match played to its result —
// every screen still works, one match runs at a time, and each starts clean.

const playButton = (page: Page) => page.getByRole('button', { name: 'Play' })
const canvas = (page: Page) => page.locator('canvas')

async function visitOptions(page: Page) {
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Game session time' })).toBeVisible()
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await expect(playButton(page)).toBeVisible()
}

async function playFresh(page: Page) {
  await playButton(page).click()
  await expect(canvas(page)).toHaveCount(1, { timeout: 15_000 })
  await expect.poll(() => state(page)).not.toBeNull()
  const fresh = await requireState(page)
  expect(fresh).toMatchObject({ status: 'running', time: 0, score: 0, spawned: 0, enemies: [], projectiles: [] })
}

test('every screen still works after several rounds of navigation, with one clean match at a time', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const uncaught: string[] = []
  page.on('pageerror', (error) => uncaught.push(error.message))
  await startTestMatch(page, { spawnIntervalSeconds: 1 })
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
  await expect(playButton(page)).toBeVisible()

  for (let round = 1; round <= 3; round++) {
    await visitOptions(page)

    // A match left from the pause menu.
    await playFresh(page)
    await step(page, 2)
    await page.getByRole('button', { name: 'Pause' }).click()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
    await expect(playButton(page)).toBeVisible()
    await expect(canvas(page)).toHaveCount(0)
    expect(await state(page), `round ${String(round)}: a match left running`).toBeNull()

    // A match played to its result.
    await playFresh(page)
    const samples = await sampleWhileHolding(page, [], 120, 1)
    expect(samples.at(-1)?.status).toBe('ended')
    await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible()
    await expect(canvas(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect(playButton(page)).toBeVisible()
  }

  // Play Again from the result starts a clean match too.
  await playFresh(page)
  await sampleWhileHolding(page, [], 120, 1)
  await page.getByRole('button', { name: 'Play Again' }).click()
  await expect(canvas(page)).toHaveCount(1, { timeout: 15_000 })
  await expect.poll(async () => (await state(page))?.time).toBe(0)

  expect(uncaught).toEqual([])
})
