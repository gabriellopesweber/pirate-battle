import { createSoundEngine } from '@/audio/soundEngine'
import { ASSET_BASE } from '@/render/assets'
import { createSoundSetting } from '@/storage/soundSetting'

/** The app's one sound engine and its mute setting, kept in step. */
export const soundSetting = createSoundSetting()

export const sound = createSoundEngine({ baseUrl: `${ASSET_BASE}sounds/`, muted: soundSetting.muted() })

soundSetting.subscribe(() => {
  sound.setMuted(soundSetting.muted())
})

/**
 * Unlocks audio on the player's first gesture — the only moment browsers let
 * it start. Until then nothing is created, so a page that blocks autoplay
 * never sees an attempt (and never logs one).
 */
export function unlockSoundOnFirstGesture(target: EventTarget = window): void {
  const events = ['pointerdown', 'keydown'] as const
  const unlock = () => {
    sound.unlock()
    for (const type of events) target.removeEventListener(type, unlock, true)
  }
  for (const type of events) target.addEventListener(type, unlock, true)
}
