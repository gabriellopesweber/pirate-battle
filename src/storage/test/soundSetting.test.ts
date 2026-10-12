// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createSoundSetting } from '@/storage/soundSetting'

beforeEach(() => {
  localStorage.clear()
})

describe('createSoundSetting', () => {
  it('starts with sound on', () => {
    expect(createSoundSetting().muted()).toBe(false)
  })

  it('keeps a mute across a refresh', () => {
    createSoundSetting().toggle()

    expect(createSoundSetting().muted()).toBe(true)
  })

  it('tells its subscribers when it changes, until they leave', () => {
    const setting = createSoundSetting()
    const seen: boolean[] = []
    const leave = setting.subscribe(() => seen.push(setting.muted()))

    setting.toggle()
    setting.toggle()
    leave()
    setting.toggle()

    expect(seen).toEqual([true, false])
  })

  it('falls back to sound on when the stored value is unreadable', () => {
    localStorage.setItem('pirate-battle:muted', '"yes"')

    expect(createSoundSetting().muted()).toBe(false)
  })
})
