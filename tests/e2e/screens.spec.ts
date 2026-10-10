import { expect, test } from '@playwright/test'
import { hud, openMenu, startMatch } from './helpers'

test('validates, saves and keeps the options after a refresh', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Options' }).click()

  const session = page.getByRole('spinbutton', { name: 'Game session time' })
  const spawn = page.getByRole('spinbutton', { name: 'Enemy spawn time' })
  const save = page.getByRole('button', { name: 'Save' })

  await session.fill('30')
  await expect(page.getByText('Must be between 60 and 180 seconds.')).toBeVisible()
  await expect(session).toHaveAttribute('aria-invalid', 'true')
  await expect(save).toBeDisabled()

  await spawn.fill('0')
  await expect(page.getByText('Must be between 1 and 10 seconds.')).toBeVisible()

  await session.fill('90')
  await page.getByRole('button', { name: 'Increase enemy spawn time' }).click()
  await expect(spawn).toHaveValue('1')
  await save.click()
  await expect(page.getByText('Options saved.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Game session time' })).toHaveValue('90')
  await expect(page.getByRole('spinbutton', { name: 'Enemy spawn time' })).toHaveValue('1')
})

test('a match uses the options saved when it starts', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByRole('spinbutton', { name: 'Game session time' }).fill('60')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await page.getByRole('button', { name: 'Play' }).click()

  await expect(hud(page)).toContainText('1:00')
})

test('leaving combat for the main menu abandons the match', async ({ page }) => {
  await startMatch(page)

  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('refreshing during combat abandons the match and returns to the menu', async ({ page }) => {
  await startMatch(page)

  await page.reload()

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('shows the last result again after a refresh', async ({ page }) => {
  await openMenu(page)
  // A finished match leaves exactly this behind; the end of a real match is
  // covered once the test clock lands (#15).
  await page.evaluate(() => {
    localStorage.setItem(
      'pirate-battle:last-result',
      JSON.stringify({ score: 7, durationSeconds: 75, reason: 'destroyed', endedAt: new Date().toISOString() }),
    )
    sessionStorage.setItem('pirate-battle:screen', JSON.stringify('result'))
  })

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeFocused()
  await expect(page.locator('.result__facts')).toContainText('1:15')
})

test('shows the scores tabs on the menu', async ({ page }) => {
  await openMenu(page)

  await page.getByRole('tab', { name: 'Ranking' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toBeVisible()
})
