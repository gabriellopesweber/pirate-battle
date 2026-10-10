import { expect, test } from '@playwright/test'

const SHIPS_IMAGE = '**/game/ships.png'

test('loads the game assets', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('status')).toHaveText('Assets loaded.')
})

test('shows progress while the assets are loading', async ({ page }) => {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(SHIPS_IMAGE, async (route) => {
    await held
    await route.continue()
  })

  await page.goto('/')

  await expect(page.getByRole('progressbar', { name: 'Loading the fleet…' })).toBeVisible()
  release()
  await expect(page.getByRole('status')).toHaveText('Assets loaded.')
})

test('reports a failed load and recovers on retry', async ({ page }) => {
  await page.route(SHIPS_IMAGE, (route) => route.abort('connectionfailed'))

  await page.goto('/')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('could not load its graphics')
  const retry = alert.getByRole('button', { name: 'Retry' })
  await expect(retry).toBeFocused()

  await page.unroute(SHIPS_IMAGE)
  await retry.click()

  await expect(page.getByRole('status')).toHaveText('Assets loaded.')
})
