import { expect, type Page } from '@playwright/test'

/** Opens the app and waits for the main menu, which shows once the assets have loaded. */
export async function openMenu(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
}

/** From a fresh page, starts a match and waits for the arena. */
export async function startMatch(page: Page): Promise<void> {
  await openMenu(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
}

export const hud = (page: Page) => page.locator('.hud')

/** Seconds left on the HUD clock. */
export async function secondsLeft(page: Page): Promise<number> {
  const text = (await hud(page).textContent()) ?? ''
  const match = /Time left (\d+):(\d+)/.exec(text)
  if (!match) throw new Error(`No time in HUD: ${text}`)
  return Number(match[1]) * 60 + Number(match[2])
}
