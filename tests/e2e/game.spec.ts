import { expect, test } from '@playwright/test'
import { hud, secondsLeft, startMatch } from './helpers'

test('mounts exactly one game canvas, even under React Strict Mode', async ({ page }) => {
  await startMatch(page)

  await page.waitForTimeout(500)
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('counts the match clock down', async ({ page }) => {
  await startMatch(page)
  await expect(hud(page)).toContainText('2:00')

  await expect.poll(() => secondsLeft(page), { timeout: 5000 }).toBeLessThan(119)
})

test('pausing freezes the clock until resumed', async ({ page }) => {
  await startMatch(page)

  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await secondsLeft(page)
  await page.waitForTimeout(2500)
  expect(await secondsLeft(page)).toBe(paused)

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect.poll(() => secondsLeft(page), { timeout: 5000 }).toBeLessThan(paused)
})
