import { expect, type Page, test } from '@playwright/test'

const hud = (page: Page) => page.locator('.game-view__hud')

async function secondsLeft(page: Page): Promise<number> {
  const text = (await hud(page).textContent()) ?? ''
  const match = /Time (\d+):(\d+)/.exec(text)
  if (!match) throw new Error(`No time in HUD: ${text}`)
  return Number(match[1]) * 60 + Number(match[2])
}

test('mounts exactly one game canvas, even under React Strict Mode', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('counts the match clock down', async ({ page }) => {
  await page.goto('/')
  await expect(hud(page)).toContainText('Time 2:00')

  await expect.poll(() => secondsLeft(page), { timeout: 5000 }).toBeLessThan(119)
})

test('pausing freezes the clock until resumed', async ({ page }) => {
  await page.goto('/')
  await expect(hud(page)).toContainText('Time')

  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await secondsLeft(page)
  await page.waitForTimeout(2500)
  expect(await secondsLeft(page)).toBe(paused)

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect.poll(() => secondsLeft(page), { timeout: 5000 }).toBeLessThan(paused)
})
