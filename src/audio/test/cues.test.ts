import { describe, expect, it } from 'vitest'
import { eventCues, hudCues } from '@/audio/cues'
import type { GameEvent } from '@/game/world/events'
import type { HudSnapshot } from '@/render/hudStore'

const PLAYER = 1
const at = { x: 0, y: 0 }

const shot = (side: 'player' | 'enemy', weapon: 'front' | 'left' | 'right' | 'shooter'): GameEvent => ({
  type: 'shot',
  side,
  weapon,
  shipId: side === 'player' ? PLAYER : 7,
  position: at,
  angle: 0,
})

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

describe('eventCues', () => {
  it('fires the bow cannon, a broadside and an enemy shot with their own sounds', () => {
    expect(eventCues([shot('player', 'front')], PLAYER)).toEqual(['cannon'])
    expect(eventCues([shot('player', 'left')], PLAYER)).toEqual(['broadside'])
    expect(eventCues([shot('enemy', 'shooter')], PLAYER)).toEqual(['cannon'])
  })

  it('plays a broadside once for its three shots, and each sound once per step', () => {
    const volley = [shot('player', 'right'), shot('player', 'right'), shot('player', 'right')]
    expect(eventCues(volley, PLAYER)).toEqual(['broadside'])
    expect(eventCues([shot('player', 'front'), shot('enemy', 'shooter')], PLAYER)).toEqual(['cannon'])
  })

  it('tells a hit on wood from a splash in the water, and stays quiet when a shot ends on land', () => {
    expect(eventCues([{ type: 'hit', targetId: 7, position: at, damage: 10 }], PLAYER)).toEqual(['woodHit'])
    expect(eventCues([{ type: 'splash', position: at, onLand: false }], PLAYER)).toEqual(['splash'])
    expect(eventCues([{ type: 'splash', position: at, onLand: true }], PLAYER)).toEqual([])
  })

  it('sinks an enemy with an explosion and a point; a ram is a collision and scores nothing', () => {
    const sunk: GameEvent = { type: 'destroyed', shipId: 7, kind: 'shooter', position: at, cause: 'player-fire' }
    const ram: GameEvent = { type: 'destroyed', shipId: 7, kind: 'chaser', position: at, cause: 'ram' }
    expect(eventCues([sunk], PLAYER)).toEqual(['explosion', 'score'])
    expect(eventCues([ram], PLAYER)).toEqual(['collision', 'explosion'])
  })

  it('leaves the player sinking to the end of the match', () => {
    const player: GameEvent = { type: 'destroyed', shipId: PLAYER, kind: 'player', position: at, cause: 'enemy-fire' }
    expect(eventCues([player], PLAYER)).toEqual([])
  })
})

describe('hudCues', () => {
  it('starts the match', () => {
    expect(hudCues(null, hud())).toEqual(['start'])
  })

  it('pauses and resumes', () => {
    expect(hudCues(hud(), hud({ status: 'paused', pauseReason: 'manual' }))).toEqual(['pause'])
    expect(hudCues(hud({ status: 'paused', pauseReason: 'manual' }), hud())).toEqual(['resume'])
  })

  it('warns once when health falls to a third, and once when ten seconds are left', () => {
    expect(hudCues(hud({ health: 40 }), hud({ health: 30 }))).toEqual(['healthLow'])
    expect(hudCues(hud({ health: 30 }), hud({ health: 20 }))).toEqual([])
    expect(hudCues(hud({ secondsLeft: 11 }), hud({ secondsLeft: 10 }))).toEqual(['timeWarning'])
    expect(hudCues(hud({ secondsLeft: 10 }), hud({ secondsLeft: 9 }))).toEqual([])
  })

  it('ends with a fanfare on time up, and with the ship sinking when it is destroyed', () => {
    expect(hudCues(hud({ secondsLeft: 1 }), hud({ status: 'ended', secondsLeft: 0, endReason: 'time-up' }))).toEqual([
      'complete',
    ])
    expect(hudCues(hud({ health: 5 }), hud({ status: 'ended', health: 0, endReason: 'destroyed' }))).toEqual([
      'sinking',
      'gameOver',
    ])
  })

  it('treats a restart as a new start', () => {
    expect(hudCues(hud({ secondsLeft: 50, score: 3 }), hud())).toEqual(['start'])
  })
})
