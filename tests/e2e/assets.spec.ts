import { expect, test } from '@playwright/test'
import { openMenu } from './helpers'

const SHIPS_IMAGE = '**/game/ships.png'

// Routes go on the context, not the page: once the MSW worker controls the
// page, asset requests pass through it, and `page.route` never sees requests
// a service worker makes — the abort and the hold would silently not happen.
const playButton = { name: 'Play' }

test('loads the game assets before showing the menu', async ({ page }) => {
  await openMenu(page)
})

test('shows progress while the assets are loading', async ({ page, context }) => {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await context.route(SHIPS_IMAGE, async (route) => {
    await held
    await route.continue()
  })

  await page.goto('/')

  await expect(page.getByRole('progressbar', { name: 'Loading the fleet…' })).toBeVisible()
  await expect(page.getByRole('button', playButton)).toBeHidden()
  release()
  await expect(page.getByRole('button', playButton)).toBeVisible({ timeout: 15_000 })
})

test('reports a failed load and recovers on retry', async ({ page, context }) => {
  await context.route(SHIPS_IMAGE, (route) => route.abort('connectionfailed'))

  await page.goto('/')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('could not load its graphics')
  const retry = alert.getByRole('button', { name: 'Retry' })
  await expect(retry).toBeFocused()

  await context.unroute(SHIPS_IMAGE)
  await retry.click()

  await expect(page.getByRole('button', playButton)).toBeVisible({ timeout: 15_000 })
})
