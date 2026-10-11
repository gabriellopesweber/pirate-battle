// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as route, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_TEST_CONFIG, makeMatch } from '@/test-utils/factories'
import { setupMockApiServer } from '@/test-utils/mockApiServer'
import { renderWithQuery } from '@/test-utils/renderWithQuery'
import { RankingPanel } from '@/ui/scores/RankingPanel'

// Seven matches with the default config: two pages of five.
const seed = () => [
  ...[12, 11, 10, 9, 8, 7].map((score, i) =>
    makeMatch({ matchId: `rival-${String(i)}`, playerId: 'rival', playerName: 'Anne Bonny', score }),
  ),
  makeMatch({ matchId: 'mine', playerId: 'me', playerName: 'Captain BEEF', score: 3 }),
]

const api = setupMockApiServer(seed)

afterEach(cleanup)

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('RankingPanel', () => {
  it('shows a loading state, then the first page ordered by rank', async () => {
    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)

    expect(screen.getByRole('status').textContent).toMatch('Loading ranking')
    await screen.findByRole('table')
    expect(rows()).toHaveLength(5)
    expect(rows()[0]?.textContent).toMatch(/1\s*Anne Bonny\s*12/)
  })

  it('says which settings the ranking compares', async () => {
    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)

    await screen.findByText('2:00 matches · enemy every 3 s')
  })

  it('pages forward and back', async () => {
    const user = userEvent.setup()
    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true)

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await screen.findByText('Page 2 of 2')
    expect(rows()).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))

    await screen.findByText('Page 1 of 2')
  })

  it("marks the player's own entries", async () => {
    const user = userEvent.setup()
    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await screen.findByText('(you)')
  })

  it('shows an empty state when nobody played with these settings', async () => {
    renderWithQuery(<RankingPanel config={{ sessionSeconds: 180, spawnIntervalSeconds: 10 }} playerId="me" />)

    await screen.findByText('No matches with these settings yet.')
  })

  it('shows an accessible error with a retry that recovers', async () => {
    const user = userEvent.setup()
    api.server.use(route.get(api.url('/ranking'), () => new HttpResponse(null, { status: 500 })))
    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)

    expect((await screen.findByRole('alert')).textContent).toMatch('The server ran into a problem.')

    api.server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByRole('table')
  })

  it('refetches when shown again, keeping the cached page on screen meanwhile', async () => {
    const calls = { count: 0 }
    api.server.events.on('request:start', () => {
      calls.count += 1
    })
    const first = renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />)
    await screen.findByRole('table')
    first.unmount()

    renderWithQuery(<RankingPanel config={DEFAULT_TEST_CONFIG} playerId="me" />, first.client)

    screen.getByRole('table')
    await screen.findByText('Page 1 of 2')
    expect(calls.count).toBe(2)
    api.server.events.removeAllListeners()
  })
})
