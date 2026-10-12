import { expect, test } from '@playwright/test'
import { startTestMatch } from './harness'
import { openMenu } from './helpers'

// Sound: a mute toggle in the menu and the pause dialog, and M during a match,
// kept across refreshes. Whether audio actually plays is a browser matter;
// what is checked here is the control, and that nothing errors when the
// browser blocks audio until a gesture.

const sound = (page: import('@playwright/test').Page, state: 'On' | 'Off') =>
  page.getByRole('button', { name: `Sound: ${state}` })

test('the sound toggle in the menu mutes, and stays muted after a refresh', async ({ page }) => {
  await openMenu(page)
  await expect(sound(page, 'On')).toBeVisible()

  await sound(page, 'On').click()
  await expect(sound(page, 'Off')).toBeVisible()

  await page.reload()
  await expect(sound(page, 'Off')).toBeVisible({ timeout: 15_000 })
})

test('M mutes during a match, and the pause dialog shows it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'M is a keyboard control')
  await startTestMatch(page)

  await page.keyboard.press('KeyM')
  await page.keyboard.press('KeyP')

  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog.getByRole('button', { name: 'Sound: Off' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Sound: Off' }).click()
  await expect(dialog.getByRole('button', { name: 'Sound: On' })).toBeVisible()
})

test('no errors while audio waits for a gesture, nor once a match plays with it', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })

  await openMenu(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(2_000)

  expect(problems).toEqual([])
})
