import { expect, type Page, test } from '@playwright/test'
import { sampleWhileHolding, startTestMatch } from './harness'
import { chooseScenario, openMenu, openTab, tabPanel } from './helpers'

// Flows 10, 11 and 12 of the brief: the score tabs through loading, empty,
// error and pagination; registering a match and both tabs catching up, with a
// pending send recovered after a refresh; a resend after a timeout without a
// duplicate, and late answers that never replace the page on screen.

// Every failure these flows provoke must be handled by the app. The browser
// still logs each failed request ("Failed to load resource") on its own, so
// the check is for exceptions the page did not catch.
let uncaught: string[] = []
test.beforeEach(({ page }) => {
  uncaught = []
  page.on('pageerror', (error) => uncaught.push(error.message))
})
test.afterEach(() => {
  expect(uncaught, 'uncaught errors in the page').toEqual([])
})

async function openMenuAt(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
}

const registration = (page: Page) => page.locator('.registration [role="status"]')

/** Plays a seeded match until the idle ship sinks, then waits for the result screen. */
async function playUntilSunk(page: Page, scenario?: string) {
  await startTestMatch(page, { spawnIntervalSeconds: 1, scenario })
  const samples = await sampleWhileHolding(page, [], 120, 1)
  expect(samples.at(-1)?.status).toBe('ended')
  await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible()
}

async function backToMenu(page: Page) {
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
}

/** The first column of each row on screen: the rank, or the date in the history. */
const firstCells = (panel: ReturnType<typeof tabPanel>) => panel.locator('tbody tr td:first-child').allTextContents()

test.describe('flow 10: browsing the score tabs', () => {
  test('both tabs show that they are loading, then their data', async ({ page }) => {
    await openMenuAt(page, '/?scenario=slow')

    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByRole('status')).toHaveText('Loading ranking…')
    await expect(ranking.getByRole('table')).toBeVisible({ timeout: 10_000 })
    await expect(ranking.getByText('Loading ranking…')).toHaveCount(0)

    const history = await openTab(page, 'Match History')
    await expect(history.getByRole('status')).toHaveText('Loading match history…')
    await expect(history.getByText('No matches yet. Play one to start your history.')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('both tabs say when there is nothing to show', async ({ page }) => {
    await openMenuAt(page, '/?scenario=empty')

    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByText('No matches with these settings yet.')).toBeVisible()
    await expect(ranking.getByRole('table')).toHaveCount(0)

    const history = await openTab(page, 'Match History')
    await expect(history.getByText('No matches yet. Play one to start your history.')).toBeVisible()
  })

  test('a tab that fails says so, offers Try again, and loads once the server is back', async ({ page }) => {
    await openMenuAt(page, '/?scenario=ranking-fails')

    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByRole('alert')).toHaveText('The server ran into a problem.', { timeout: 15_000 })
    // Only the ranking fails in this scenario.
    const history = await openTab(page, 'Match History')
    await expect(history.getByRole('alert')).toHaveCount(0)
    await expect(history.getByText('No matches yet. Play one to start your history.')).toBeVisible()

    await openTab(page, 'Ranking')
    await expect(ranking.getByRole('alert')).toBeVisible({ timeout: 15_000 })
    await ranking.getByRole('button', { name: 'Try again' }).click()
    await expect(ranking.getByRole('alert')).toBeVisible({ timeout: 15_000 })

    await chooseScenario(page, 'Success')
    await expect(ranking.getByRole('alert')).toHaveCount(0)
    await expect(ranking.getByRole('table')).toBeVisible({ timeout: 15_000 })
  })

  test('the ranking pages forwards and back', async ({ page }) => {
    await openMenu(page)
    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByText(/^Page 1 of \d+$/)).toBeVisible()
    expect(await firstCells(ranking)).toEqual(['1', '2', '3', '4', '5'])
    await expect(ranking.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await ranking.getByRole('button', { name: 'Next page' }).click()

    await expect(ranking.getByText(/^Page 2 of \d+$/)).toBeVisible()
    expect((await firstCells(ranking)).at(0)).toBe('6')

    await ranking.getByRole('button', { name: 'Previous page' }).click()
    await expect(ranking.getByText(/^Page 1 of \d+$/)).toBeVisible()
    expect((await firstCells(ranking)).at(0)).toBe('1')
  })
})

test.describe('flow 11: registering a match', () => {
  test('a finished match is saved and shows in both tabs', async ({ page }) => {
    await playUntilSunk(page)
    await expect(registration(page)).toHaveText('Saved')

    await backToMenu(page)
    const history = await openTab(page, 'Match History')
    await expect(history.locator('tbody tr')).toHaveCount(1)
    await expect(history.locator('tbody tr')).toContainText('Ship sunk')
    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByText('(you)')).toBeVisible()
  })

  test('a match the server could not take stays pending through a refresh and is sent when it returns', async ({
    page,
  }) => {
    await playUntilSunk(page, 'register-offline')
    await expect(registration(page)).toHaveText(/^Not saved: Could not reach the server/, { timeout: 15_000 })

    await page.reload()
    // Recovered on start, tried again, and still not taken.
    await expect(page.getByRole('heading', { name: 'Your ship sank' })).toBeVisible({ timeout: 15_000 })
    await expect(registration(page)).toHaveText(/^Not saved: Could not reach the server/, { timeout: 15_000 })

    await backToMenu(page)
    const history = await openTab(page, 'Match History')
    await expect(history.getByText('No matches yet. Play one to start your history.')).toBeVisible()

    await chooseScenario(page, 'Success')

    await expect(history.locator('tbody tr')).toHaveCount(1, { timeout: 15_000 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
    await expect((await openTab(page, 'Match History')).locator('tbody tr')).toHaveCount(1)
  })
})

test.describe('flow 12: timeouts and late answers', () => {
  test('a registration answered too late is sent again and saved once', async ({ page }) => {
    test.setTimeout(60_000)
    await playUntilSunk(page, 'register-timeout')
    await expect(registration(page)).toHaveText('Sending…')

    // The client gives up after 5 s and resends; the server already has it.
    await expect(registration(page)).toHaveText('Saved', { timeout: 20_000 })

    await backToMenu(page)
    const history = await openTab(page, 'Match History')
    await expect(history.locator('tbody tr')).toHaveCount(1)
    await expect(history.getByText(/^Page 1 of 1$/)).toBeVisible()
  })

  test('paging back and forth while answers arrive out of order ends on the page asked for', async ({ page }) => {
    await openMenuAt(page, '/?scenario=out-of-order')
    const ranking = await openTab(page, 'Ranking')
    await expect(ranking.getByText(/^Page 1 of \d+$/)).toBeVisible({ timeout: 15_000 })
    await ranking.getByRole('button', { name: 'Next page' }).click()
    await expect(ranking.getByText(/^Page 2 of \d+$/)).toBeVisible({ timeout: 15_000 })

    // Both pages are cached now: each click shows one at once and refetches it,
    // the refetches answering in reverse order.
    await ranking.getByRole('button', { name: 'Previous page' }).click()
    await ranking.getByRole('button', { name: 'Next page' }).click()
    await ranking.getByRole('button', { name: 'Previous page' }).click()
    await ranking.getByRole('button', { name: 'Next page' }).click()

    await expect(ranking.getByText(/^(Loading|Updating) ranking…$/)).toHaveCount(0, { timeout: 15_000 })
    await expect(ranking.getByText(/^Page 2 of \d+$/)).toBeVisible()
    expect((await firstCells(ranking)).at(0)).toBe('6')
  })
})
