// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as route, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { makeMatch } from '@/test-utils/factories'
import { setupMockApiServer } from '@/test-utils/mockApiServer'
import { renderWithQuery } from '@/test-utils/renderWithQuery'
import { HistoryPanel } from '@/ui/scores/HistoryPanel'

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T12:00:00.000Z`

// Six of the player's matches (two pages) and one of someone else.
const seed = () => [
  makeMatch({ playerId: 'me', score: 4, durationSeconds: 75, endReason: 'destroyed', endedAt: day(6) }),
  ...[1, 2, 3, 4, 5].map((n) => makeMatch({ playerId: 'me', score: n, endedAt: day(n) })),
  makeMatch({ playerId: 'rival', score: 30 }),
]

const api = setupMockApiServer(seed)

afterEach(cleanup)

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('HistoryPanel', () => {
  it("lists the player's own matches, most recent first, with score, duration and end reason", async () => {
    renderWithQuery(<HistoryPanel playerId="me" />)

    await screen.findByRole('table')
    expect(rows()).toHaveLength(5)
    expect(rows()[0]?.textContent).toMatch(/4\s*1:15\s*Ship sunk/)
    expect(rows()[1]?.textContent).toMatch(/5\s*2:00\s*Time up/)
  })

  it('pages to the older matches', async () => {
    const user = userEvent.setup()
    renderWithQuery(<HistoryPanel playerId="me" />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await screen.findByText('Page 2 of 2')
    expect(rows()).toHaveLength(1)
  })

  it('shows an empty state before the first match', async () => {
    renderWithQuery(<HistoryPanel playerId="newcomer" />)

    await screen.findByText('No matches yet. Play one to start your history.')
  })

  it('shows an accessible error when the history cannot be read', async () => {
    api.server.use(route.get(api.url('/players/:playerId/matches'), () => HttpResponse.error()))
    renderWithQuery(<HistoryPanel playerId="me" />)

    expect((await screen.findByRole('alert')).textContent).toMatch('Could not reach the server.')
    screen.getByRole('button', { name: 'Try again' })
  })
})
