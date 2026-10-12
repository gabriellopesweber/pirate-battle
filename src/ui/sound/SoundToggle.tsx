import { useSyncExternalStore } from 'react'
import { soundSetting } from '@/audio/sound'
import { RoundButton } from '@/ui/kit/RoundButton'

// Drawn for this game in the style of the atlas icons, which have no speaker.
const ICONS = {
  on: `${import.meta.env.BASE_URL}icons/sound-on.svg`,
  off: `${import.meta.env.BASE_URL}icons/sound-off.svg`,
}

/** Sound on or off, kept across refreshes. M does the same during a match. */
export function SoundToggle({ size = 48 }: { size?: number }) {
  const muted = useSyncExternalStore(soundSetting.subscribe, soundSetting.muted)
  return (
    <RoundButton
      image={muted ? ICONS.off : ICONS.on}
      label={muted ? 'Sound: Off' : 'Sound: On'}
      size={size}
      onClick={soundSetting.toggle}
    />
  )
}
