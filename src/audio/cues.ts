import type { EntityId } from '@/game/core/entityStore'
import type { GameEvent } from '@/game/world/events'
import type { HudSnapshot } from '@/render/hudStore'

/**
 * What the match sounds like, as cues: the simulation and the HUD say what
 * happened, these functions say what to play. Pure — the sound engine only
 * turns a cue into audio — so every rule here is tested without a speaker.
 */
export type Cue =
  | 'cannon'
  | 'broadside'
  | 'woodHit'
  | 'splash'
  | 'explosion'
  | 'score'
  | 'collision'
  | 'start'
  | 'pause'
  | 'resume'
  | 'healthLow'
  | 'timeWarning'
  | 'complete'
  | 'sinking'
  | 'gameOver'

/** The health bar turns red below a third; the warning sounds as it does. */
const LOW_HEALTH = 1 / 3
const WARNING_SECONDS = 10

/**
 * The cues for one simulation step's events, each at most once: a broadside
 * is three shots and one sound, and a crowded step is not a wall of noise.
 * The player's own ship sinking is left to the end of the match.
 */
export function eventCues(events: readonly GameEvent[], playerId: EntityId): Cue[] {
  const cues = new Set<Cue>()
  for (const event of events) {
    switch (event.type) {
      case 'shot':
        cues.add(event.weapon === 'left' || event.weapon === 'right' ? 'broadside' : 'cannon')
        break
      case 'hit':
        cues.add('woodHit')
        break
      case 'splash':
        if (!event.onLand) cues.add('splash')
        break
      case 'destroyed':
        if (event.shipId === playerId) break
        if (event.cause === 'ram') cues.add('collision')
        cues.add('explosion')
        if (event.cause === 'player-fire') cues.add('score')
        break
    }
  }
  return [...cues]
}

/**
 * The cues for a change in the match's state: the start (or a restart), pause
 * and resume, the two warnings — each once, as its threshold is crossed — and
 * the end.
 */
export function hudCues(previous: HudSnapshot | null, next: HudSnapshot): Cue[] {
  if (previous === null || next.secondsLeft > previous.secondsLeft) return ['start']
  if (next.status === 'ended' && previous.status !== 'ended') {
    return next.endReason === 'time-up' ? ['complete'] : ['sinking', 'gameOver']
  }
  if (next.status !== previous.status) return next.status === 'paused' ? ['pause'] : ['resume']

  const cues: Cue[] = []
  const low = (hud: HudSnapshot) => hud.health <= hud.maxHealth * LOW_HEALTH
  if (low(next) && !low(previous)) cues.push('healthLow')
  if (next.secondsLeft === WARNING_SECONDS && previous.secondsLeft > WARNING_SECONDS) cues.push('timeWarning')
  return cues
}
