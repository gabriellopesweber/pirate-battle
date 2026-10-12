import type { HudSnapshot } from '@/render/hudStore'
import { formatClock } from '@/ui/format'

/** Seconds left worth a word: the clock itself changes every second, which nobody wants read out. */
const TIME_MARKS: Readonly<Record<number, string>> = {
  60: '1 minute left.',
  30: '30 seconds left.',
  10: '10 seconds left.',
}

/**
 * What a screen reader should hear when the HUD goes from `previous` to
 * `next`, or null for nothing. Only meaningful changes speak: the start (or a
 * restart), pausing and resuming, a new score and a few time marks. The end
 * is left to the result screen, which takes focus.
 */
export function announcement(previous: HudSnapshot | null, next: HudSnapshot): string | null {
  const started = previous === null || next.secondsLeft > previous.secondsLeft
  if (started) return `Match started. ${formatClock(next.secondsLeft)} left.`
  if (next.status === 'ended') return null

  if (next.status !== previous.status) {
    if (next.status === 'running') return 'Resumed.'
    return next.pauseReason === 'focus-lost' ? 'Paused while the game was in the background.' : 'Paused.'
  }

  const parts: string[] = []
  if (next.score !== previous.score) parts.push(`Score ${String(next.score)}.`)
  const mark = next.secondsLeft !== previous.secondsLeft ? TIME_MARKS[next.secondsLeft] : undefined
  if (mark) parts.push(mark)
  return parts.length > 0 ? parts.join(' ') : null
}
