import { expect, test } from '@playwright/test'
import { hud, startMatch } from './helpers'

test('shows the controls and pauses with the keyboard', async ({ page, isMobile }) => {
  await startMatch(page)

  const touch = page.getByRole('button', { name: 'Fire bow cannon' })
  if (isMobile) {
    await expect(touch).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sail forward' })).toBeVisible()
    await expect(page.getByLabel('Keyboard controls')).toBeHidden()
  } else {
    await expect(page.getByLabel('Keyboard controls')).toBeVisible()
    await expect(touch).toBeHidden()

    await page.keyboard.press('KeyP')
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  }
})

test('restarts a fresh match with R, and from the pause dialog', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the R key is a keyboard control')
  await startMatch(page)
  await expect(hud(page)).toContainText('1:5', { timeout: 15_000 })

  await page.keyboard.press('KeyR')
  await expect(hud(page)).toContainText('2:00')
  await expect(page.locator('canvas')).toHaveCount(1)

  await expect(hud(page)).toContainText('1:5', { timeout: 15_000 })
  await page.keyboard.press('KeyP')
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Restart' }).click()
  await expect(hud(page)).toContainText('2:00')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('hides the touch controls while paused', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch controls only show on touch screens')
  await startMatch(page)
  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()

  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeHidden()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('button', { name: 'Fire bow cannon' })).toBeVisible()
})
