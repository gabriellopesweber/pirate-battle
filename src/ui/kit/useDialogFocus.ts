import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus handling for a modal dialog: on open, focus moves to the control
 * given `initialFocusRef`; Tab and Shift+Tab cycle inside the dialog; on
 * close, focus goes back to whatever had it before — if it is still on the
 * page.
 */
export function useDialogFocus<T extends HTMLElement>() {
  const dialogRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<T>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    initialFocusRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (!first || !last) return
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return { dialogRef, initialFocusRef }
}
