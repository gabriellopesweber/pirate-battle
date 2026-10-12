import { describe, expect, it } from 'vitest'
import type { HudSnapshot } from '@/render/hudStore'
import { announcement } from '@/ui/game/announcement'

const hud = (patch: Partial<HudSnapshot> = {}): HudSnapshot => ({
  status: 'running',
  pauseReason: null,
  score: 0,
  secondsLeft: 120,
  health: 100,
  maxHealth: 100,
  endReason: null,
  ...patch,
})

describe('announcement', () => {
  it('announces the start of a match with the time it has', () => {
    expect(announcement(null, hud())).toBe('Match started. 2:00 left.')
  })

  it('stays quiet while nothing that matters changes', () => {
    expect(announcement(hud(), hud({ secondsLeft: 119, health: 80 }))).toBeNull()
    expect(announcement(hud({ secondsLeft: 75 }), hud({ secondsLeft: 74 }))).toBeNull()
  })

  it('announces each new score', () => {
    expect(announcement(hud({ score: 2 }), hud({ score: 3 }))).toBe('Score 3.')
  })

  it('announces pausing, why, and resuming', () => {
    expect(announcement(hud(), hud({ status: 'paused', pauseReason: 'manual' }))).toBe('Paused.')
    expect(announcement(hud(), hud({ status: 'paused', pauseReason: 'focus-lost' }))).toBe(
      'Paused while the game was in the background.',
    )
    expect(announcement(hud({ status: 'paused', pauseReason: 'manual' }), hud())).toBe('Resumed.')
  })

  it('announces one minute, thirty seconds and ten seconds left — once each', () => {
    expect(announcement(hud({ secondsLeft: 61 }), hud({ secondsLeft: 60 }))).toBe('1 minute left.')
    expect(announcement(hud({ secondsLeft: 31 }), hud({ secondsLeft: 30 }))).toBe('30 seconds left.')
    expect(announcement(hud({ secondsLeft: 11 }), hud({ secondsLeft: 10 }))).toBe('10 seconds left.')
    expect(announcement(hud({ secondsLeft: 10 }), hud({ secondsLeft: 10, health: 50 }))).toBeNull()
  })

  it('names the score and a time mark together when both change at once', () => {
    expect(announcement(hud({ secondsLeft: 31, score: 4 }), hud({ secondsLeft: 30, score: 5 }))).toBe(
      'Score 5. 30 seconds left.',
    )
  })

  it('leaves the end of the match to the result screen', () => {
    expect(announcement(hud({ secondsLeft: 1 }), hud({ status: 'ended', secondsLeft: 0, endReason: 'time-up' }))).toBeNull()
  })

  it('announces a restart as a new start', () => {
    expect(announcement(hud({ score: 4, secondsLeft: 50 }), hud())).toBe('Match started. 2:00 left.')
  })
})
