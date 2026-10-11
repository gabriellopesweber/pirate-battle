// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadPlayer } from '@/storage/player'

beforeEach(() => {
  localStorage.clear()
})

describe('loadPlayer', () => {
  it('creates a player with an id and a display name on first use', () => {
    const player = loadPlayer()

    expect(player.id).not.toBe('')
    expect(player.name).toMatch(/^Captain [0-9A-F]{4}$/)
  })

  it('returns the same player on every later load, as after a refresh', () => {
    const first = loadPlayer()

    expect(loadPlayer()).toEqual(first)
  })

  it('replaces an unreadable stored player with a new one', () => {
    localStorage.setItem('pirate-battle:player', '{"id":42}')

    expect(typeof loadPlayer().id).toBe('string')
  })
})
