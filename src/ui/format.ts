import type { EndReason } from '@/game/match/match'

/** Whole seconds as m:ss — the HUD and result screen format. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
}

export const END_REASON_LABEL: Readonly<Record<EndReason, string>> = { 'time-up': 'Time up', destroyed: 'Ship sunk' }

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

/** An ISO date in the player's time zone, e.g. "Oct 6, 2026, 9:00 AM". */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}
