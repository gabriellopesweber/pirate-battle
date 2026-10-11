import { expect, test } from '@playwright/test'
import { openMenu } from './helpers'

const contentTypeOf = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const response = await fetch('/api/ranking?sessionSeconds=120&spawnIntervalSeconds=3')
    return response.headers.get('content-type') ?? ''
  })

// #42: the mock worker keeps the pages it serves in memory only. When that
// list empties — the worker was stopped while idle, or a reload's race made
// it unregister itself — it passes every request through to the network, and
// the API answers with the SPA's index.html. Telling the worker this page has
// closed reproduces that state on demand.
test('recovers when the mock worker stops answering for this page', async ({ page }) => {
  await openMenu(page)
  await page.evaluate(() => {
    navigator.serviceWorker.controller?.postMessage('CLIENT_CLOSE')
  })
  await expect.poll(() => contentTypeOf(page)).toContain('text/html')

  await page.getByRole('tab', { name: 'Ranking' }).click()

  const ranking = page.getByRole('tabpanel', { name: 'Ranking' })
  await expect(ranking.getByRole('table')).toBeVisible({ timeout: 15_000 })
  expect(await contentTypeOf(page)).toContain('application/json')
})
