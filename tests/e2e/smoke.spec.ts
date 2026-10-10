import { expect, test } from '@playwright/test'

test('app loads with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('reloading a deep URL still serves the app', async ({ page }) => {
  await page.goto('/any/deep/path')

  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible({ timeout: 15_000 })
})
