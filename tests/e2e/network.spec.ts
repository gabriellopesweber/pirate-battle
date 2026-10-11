import { expect, type Page, test } from '@playwright/test'

async function openMenuAt(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
}

const tabPanel = (page: Page, name: string) => page.getByRole('tabpanel', { name })

async function openTab(page: Page, name: 'Ranking' | 'Match History') {
  await page.getByRole('tab', { name }).click()
  return tabPanel(page, name)
}

async function chooseScenario(page: Page, label: string) {
  await page.getByText('Network scenario').click()
  await page.getByRole('combobox', { name: 'Scenario' }).selectOption({ label })
}

test('a scenario chosen in the URL applies on load and only where it says', async ({ page }) => {
  await openMenuAt(page, '/?scenario=history-fails')

  const history = await openTab(page, 'Match History')
  await expect(history.getByRole('alert')).toHaveText('The server ran into a problem.', { timeout: 15_000 })

  const ranking = await openTab(page, 'Ranking')
  await expect(ranking.getByRole('table')).toBeVisible()

  await page.getByText('Network scenario').click()
  await expect(page.getByRole('combobox', { name: 'Scenario' })).toHaveValue('history-fails')
})

test('a scenario chosen in the panel applies at once, and survives a refresh', async ({ page }) => {
  await openMenuAt(page, '/')
  const ranking = await openTab(page, 'Ranking')
  await expect(ranking.getByRole('table')).toBeVisible()

  await chooseScenario(page, 'Empty lists')

  await expect(ranking.getByText('No matches with these settings yet.')).toBeVisible()
  await page.reload()
  await openTab(page, 'Ranking')
  await expect(tabPanel(page, 'Ranking').getByText('No matches with these settings yet.')).toBeVisible({
    timeout: 15_000,
  })
})

test('reset restores the fixtures and the success scenario', async ({ page }) => {
  await openMenuAt(page, '/?scenario=offline')
  const ranking = await openTab(page, 'Ranking')
  await expect(ranking.getByRole('alert')).toHaveText('Could not reach the server.', { timeout: 15_000 })

  await page.getByText('Network scenario').click()
  await page.getByRole('button', { name: 'Reset data' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
  await expect((await openTab(page, 'Ranking')).getByRole('table')).toBeVisible()
  await page.getByText('Network scenario').click()
  await expect(page.getByRole('combobox', { name: 'Scenario' })).toHaveValue('success')
})
