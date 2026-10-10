/** The two browser objects auto-pause listens to; `EventTarget` keeps it testable without a DOM. */
export interface AutoPauseTargets {
  window: EventTarget
  document: EventTarget & { readonly visibilityState: DocumentVisibilityState }
}

/**
 * Calls `onFocusLost` when the window loses focus or the tab is hidden.
 * Returns a function that removes both listeners.
 *
 * Only pauses — resuming is always the player's explicit action, so a match
 * never restarts by itself when the tab comes back.
 */
export function watchFocusLoss(targets: AutoPauseTargets, onFocusLost: () => void): () => void {
  const onBlur = () => {
    onFocusLost()
  }
  const onVisibility = () => {
    if (targets.document.visibilityState === 'hidden') onFocusLost()
  }
  targets.window.addEventListener('blur', onBlur)
  targets.document.addEventListener('visibilitychange', onVisibility)
  return () => {
    targets.window.removeEventListener('blur', onBlur)
    targets.document.removeEventListener('visibilitychange', onVisibility)
  }
}
