// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDialogFocus } from '@/ui/kit/useDialogFocus'

afterEach(cleanup)

function Dialog({ onClose }: { onClose: () => void }) {
  const { dialogRef, initialFocusRef } = useDialogFocus<HTMLButtonElement>()
  return (
    <div role="dialog" aria-label="Paused" ref={dialogRef}>
      <button type="button" ref={initialFocusRef} onClick={onClose}>
        Resume
      </button>
      <button type="button">Restart</button>
      <button type="button">Main Menu</button>
    </div>
  )
}

function Screen() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Pause
      </button>
      <button type="button">Outside</button>
      {open && (
        <Dialog
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

const button = (name: string) => screen.getByRole('button', { name })

describe('useDialogFocus', () => {
  it('focuses the chosen control when the dialog opens', async () => {
    render(<Screen />)
    await userEvent.click(button('Pause'))

    expect(document.activeElement).toBe(button('Resume'))
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    render(<Screen />)
    await userEvent.click(button('Pause'))

    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(button('Main Menu'))
    await userEvent.tab()
    expect(document.activeElement).toBe(button('Resume'))
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(button('Main Menu'))
  })

  it('gives focus back to where it was when the dialog closes', async () => {
    render(<Screen />)
    button('Pause').focus()
    await userEvent.keyboard('{Enter}')

    await userEvent.keyboard('{Enter}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button('Pause'))
  })
})
