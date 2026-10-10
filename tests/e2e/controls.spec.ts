import { expect, test } from '@playwright/test'

test('shows the controls and pauses with the keyboard', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  const touch = page.getByRole('button', { name: 'Fire bow cannon' })
  if (isMobile) {
    await expect(touch).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sail forward' })).toBeVisible()
    await expect(page.getByLabel('Keyboard controls')).toBeHidden()
  } else {
    await expect(page.getByLabel('Keyboard controls')).toBeVisible()
    await expect(touch).toBeHidden()

    await page.keyboard.press('KeyP')
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  }
})

test('restarts a fresh match with R, and with the button while paused', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the R key is a keyboard control')
  const hud = page.locator('.game-view__hud')
  await page.goto('/')
  await expect(hud).toContainText('Time 1:5', { timeout: 15_000 })

  await page.keyboard.press('KeyR')
  await expect(hud).toContainText('Time 2:00')
  await expect(page.locator('canvas')).toHaveCount(1)

  await expect(hud).toContainText('Time 1:5', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Restart' }).click()
  await expect(hud).toContainText('Time 2:00')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('hides the touch controls while paused', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch controls only show on touch screens')
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()

  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeHidden()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeVisible()
})
