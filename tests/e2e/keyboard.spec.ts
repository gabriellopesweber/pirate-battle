import { expect, type Locator, type Page, test } from '@playwright/test'
import { sampleWhileHolding, state } from './harness'

// Brief §7: keyboard navigation in the menus, visible focus and focus control
// in dialogs. The whole menu → Options → Play → result → menu loop, keyboard
// only.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'keyboard navigation is a desktop concern')
})

/** Presses Tab (or Shift+Tab) until `target` has focus, checking each stop shows a focus ring. */
async function tabTo(page: Page, target: Locator, { backwards = false } = {}) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab')
    const outline = await page.evaluate(() => document.activeElement && getComputedStyle(document.activeElement).outlineStyle)
    expect(outline, 'the focused control shows a focus ring').not.toBe('none')
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error(`Tab never reached ${target.toString()}`)
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test('the whole loop works from the keyboard alone, with visible focus', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?test&clock=manual&matchSeed=1')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })

  // Options: change both values and save.
  await tabTo(page, button(page, 'Options'))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('spinbutton', { name: 'Game session time' })).toBeVisible()
  await tabTo(page, page.getByRole('spinbutton', { name: 'Game session time' }))
  await page.keyboard.press('Control+A')
  await page.keyboard.type('60')
  await tabTo(page, page.getByRole('spinbutton', { name: 'Enemy spawn time' }))
  await page.keyboard.press('Control+A')
  await page.keyboard.type('1')
  await tabTo(page, button(page, 'Save'))
  await page.keyboard.press('Enter')
  await expect(page.getByText('Options saved.')).toBeVisible()
  await tabTo(page, button(page, 'Main Menu'))
  await page.keyboard.press('Enter')

  // The score tabs move with the arrow keys.
  await tabTo(page, page.getByRole('tab', { name: 'Ranking' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Match History' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toBeVisible()

  // Play, pause from the keyboard: focus stays inside the dialog.
  await tabTo(page, button(page, 'Play'), { backwards: true })
  await page.keyboard.press('Enter')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => state(page)).not.toBeNull()
  await page.keyboard.press('KeyP')
  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.locator(':focus').count(), 'focus left the pause dialog').toBe(1)
  }
  await tabTo(page, dialog.getByRole('button', { name: 'Resume' }))
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()

  // Pausing from the HUD button gives focus back to it on resume.
  await tabTo(page, button(page, 'Pause'))
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeFocused()

  // To the result and back to the menu.
  await sampleWhileHolding(page, [], 60, 1)
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeFocused()
  await tabTo(page, button(page, 'Main Menu'))
  await page.keyboard.press('Enter')
  await expect(button(page, 'Play')).toBeVisible()
})
