// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as route, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MatchRecord } from '@/api/contracts'
import { pendingMatches } from '@/storage/pendingMatches'
import { makeMatch } from '@/test-utils/factories'
import { setupMockApiServer } from '@/test-utils/mockApiServer'
import { renderWithQuery } from '@/test-utils/renderWithQuery'
import { RegistrationStatus } from '@/ui/result/RegistrationStatus'
import { HistoryPanel } from '@/ui/scores/HistoryPanel'

const api = setupMockApiServer(() => [])

const match = (): MatchRecord => makeMatch({ matchId: 'ended-now', playerId: 'me', score: 6 })

beforeEach(() => {
  for (const record of pendingMatches.list()) pendingMatches.remove(record.matchId)
})

afterEach(cleanup)

const status = () => screen.getByRole('status')
const tryAgain = () => screen.getByRole('button', { name: 'Try again' })

async function historyRows() {
  const table = await screen.findByRole('table')
  return within(table).getAllByRole('row').slice(1)
}

describe('RegistrationStatus', () => {
  it('shows a pending match as not sent yet, with a way to send it', () => {
    pendingMatches.add(match())

    renderWithQuery(<RegistrationStatus matchId="ended-now" />)

    expect(status().textContent).toBe('Not sent yet')
    expect(tryAgain()).toBeDefined()
  })

  it('shows a match that is no longer pending as saved', () => {
    renderWithQuery(<RegistrationStatus matchId="confirmed-before-refresh" />)

    expect(status().textContent).toBe('Saved')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('sends on Try again, then leaves the queue and refreshes the history on screen', async () => {
    const user = userEvent.setup()
    pendingMatches.add(match())
    renderWithQuery(
      <>
        <RegistrationStatus matchId="ended-now" />
        <HistoryPanel playerId="me" />
      </>,
    )
    await screen.findByText('No matches yet. Play one to start your history.')

    await user.click(tryAgain())

    await screen.findByText('Saved')
    expect(pendingMatches.has('ended-now')).toBe(false)
    expect(await historyRows()).toHaveLength(1)
  })

  it('keeps the match pending and explains the failure when the server is down', async () => {
    const user = userEvent.setup()
    api.server.use(route.post(api.url('/matches'), () => new HttpResponse(null, { status: 503 })))
    pendingMatches.add(match())
    renderWithQuery(<RegistrationStatus matchId="ended-now" />)

    await user.click(tryAgain())

    await screen.findByText('Not saved: The server ran into a problem.')
    expect(pendingMatches.has('ended-now')).toBe(true)
    expect(tryAgain()).toBeDefined()
  })

  it('recovers a match the server stored but whose answer was lost, without a duplicate', async () => {
    const user = userEvent.setup()
    const posts = { count: 0 }
    api.server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') posts.count += 1
    })
    // Once: the server stores the match, then the connection drops before it
    // answers. The automatic retry then reaches the real handler.
    api.server.use(
      route.post(
        api.url('/matches'),
        async ({ request }) => {
          api.db().register((await request.json()) as MatchRecord)
          return HttpResponse.error()
        },
        { once: true },
      ),
    )
    pendingMatches.add(match())
    renderWithQuery(
      <>
        <RegistrationStatus matchId="ended-now" />
        <HistoryPanel playerId="me" />
      </>,
    )

    await user.click(tryAgain())

    await screen.findByText('Saved')
    expect(posts.count).toBe(2)
    expect(await historyRows()).toHaveLength(1)
    api.server.events.removeAllListeners()
  })
})
