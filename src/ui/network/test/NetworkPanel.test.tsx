// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCENARIO_IDS, SCENARIOS } from '@/mocks/scenarios'
import { NetworkPanel } from '@/ui/network/NetworkPanel'

afterEach(cleanup)

const renderPanel = (overrides: Partial<Parameters<typeof NetworkPanel>[0]> = {}) => {
  const props = { scenario: 'success' as const, onChange: vi.fn(), onReset: vi.fn(), ...overrides }
  render(<NetworkPanel {...props} />)
  return props
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText('Network scenario'))
}

describe('NetworkPanel', () => {
  it('stays collapsed until opened', () => {
    renderPanel()

    expect(screen.getByRole('group').hasAttribute('open')).toBe(false)
  })

  it('offers every scenario and explains the selected one', async () => {
    const user = userEvent.setup()
    renderPanel({ scenario: 'slow' })
    await open(user)

    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Scenario' })
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      SCENARIO_IDS.map((id) => SCENARIOS[id].label),
    )
    expect(select.value).toBe('slow')
    expect(screen.getByText(SCENARIOS.slow.description)).toBeDefined()
  })

  it('reports the scenario chosen', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPanel()
    await open(user)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Scenario' }), 'offline')

    expect(onChange).toHaveBeenCalledWith('offline')
  })

  it('resets the demo data on request', async () => {
    const user = userEvent.setup()
    const { onReset } = renderPanel()
    await open(user)

    await user.click(screen.getByRole('button', { name: 'Reset data' }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
