import { expect, test } from '@playwright/test'
import { sampleWhileHolding, startTestMatch } from './harness'
import { openMenu } from './helpers'

// Visual regression of the menu, the arena in a stable state and the result
// screen. The baselines are rendered on Linux — the platform CI runs on — in
// the official Playwright image (README → Visual baselines); fonts and software
// WebGL differ on other systems, so a comparison there would only report the
// platform.

test.beforeEach(() => {
  test.skip(process.platform !== 'linux', 'baselines are rendered on Linux; run them in the Playwright image')
})

test('main menu', async ({ page }) => {
  await openMenu(page)

  await expect(page).toHaveScreenshot('main-menu.png')
})

test('arena at the start of a seeded match', async ({ page }) => {
  // Manual clock and a fixed seed: nothing moves until a test steps time.
  await startTestMatch(page)

  await expect(page).toHaveScreenshot('arena-start.png')
})

test('result screen', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 1 })
  await sampleWhileHolding(page, [], 120, 1)
  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible()
  await expect(page.locator('.registration [role="status"]')).toHaveText('Saved')

  await expect(page).toHaveScreenshot('result.png')
})
