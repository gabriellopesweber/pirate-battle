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

export const tabPanel = (page: Page, name: string) => page.getByRole('tabpanel', { name })

/** Opens one of the main menu's score tabs and returns its panel. */
export async function openTab(page: Page, name: 'Ranking' | 'Match History') {
  await page.getByRole('tab', { name }).click()
  return tabPanel(page, name)
}

/** Picks a network scenario in the main menu's panel. */
export async function chooseScenario(page: Page, label: string) {
  await page.getByText('Network scenario').click()
  await page.getByRole('combobox', { name: 'Scenario' }).selectOption({ label })
}
