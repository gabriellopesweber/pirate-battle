import { useEffect, useRef, useState } from 'react'
import type { HudSnapshot } from '@/render/hudStore'
import { announcement } from '@/ui/game/announcement'

/**
 * A polite live region, visually hidden, that reads out the match's
 * meaningful changes (see `announcement`). It is always rendered — a live
 * region announces only changes to one that already exists.
 */
export function MatchAnnouncer({ hud }: { hud: HudSnapshot }) {
  const previous = useRef<HudSnapshot | null>(null)
  const [message, setMessage] = useState({ text: '', count: 0 })

  useEffect(() => {
    const text = announcement(previous.current, hud)
    previous.current = hud
    // The same words twice in a row are not re-read unless the text differs:
    // alternate a trailing no-break space.
    if (text) setMessage((last) => ({ text, count: last.count + 1 }))
  }, [hud])

  return (
    <p role="status" className="visually-hidden">
      {message.text + (message.count % 2 === 0 ? '' : '\u00a0')}
    </p>
  )
}
