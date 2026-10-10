import type { GameConfig } from '@/game/config/gameConfig'
import type { PlayerInput, World } from '@/game/world/state'
import { createWorld, stepWorld } from '@/game/world/world'

export type MatchStatus = 'running' | 'paused' | 'ended'
export type EndReason = 'time-up' | 'destroyed'
export type PauseReason = 'manual' | 'focus-lost'

export interface MatchResult {
  score: number
  /** Active play time, excluding pauses. */
  durationSeconds: number
  reason: EndReason
  seed: number
  config: Readonly<GameConfig>
}

// Float tolerance when the elapsed time is compared with the duration.
const EPSILON = 1e-9

/**
 * One match: the world plus its rules — clock, score, end and pause.
 *
 * `step` is the only thing that advances the match, and it does nothing
 * unless the match is running. So pausing freezes the countdown, cooldowns,
 * movement and spawns together, and once the match ends nothing can move,
 * fire, take damage, spawn or score. Restarting means creating a new Match.
 */
export class Match {
  readonly world: World
  readonly seed: number
  private currentStatus: MatchStatus = 'running'
  private currentPause: PauseReason | null = null
  private currentScore = 0
  private currentResult: MatchResult | null = null

  constructor(config: Readonly<GameConfig>, seed: number) {
    this.world = createWorld(config, seed)
    this.seed = seed
  }

  step(input: PlayerInput, dt: number): void {
    if (this.currentStatus !== 'running') return

    stepWorld(this.world, { player: input }, dt)

    // Events arrive in the order they happened within the step; once the
    // player sinks, later events of the same step no longer count.
    for (const event of this.world.events) {
      if (event.type !== 'destroyed') continue
      if (event.kind === 'player') {
        this.end('destroyed')
        return
      }
      if (event.cause === 'player-fire') this.currentScore++
    }

    if (this.world.time + EPSILON >= this.world.config.match.durationSeconds) this.end('time-up')
  }

  /** Pauses a running match. A manual pause is not overridden by a later focus loss. */
  pause(reason: PauseReason): void {
    if (this.currentStatus !== 'running') return
    this.currentStatus = 'paused'
    this.currentPause = reason
  }

  /** Resumes a paused match. Only ever called from an explicit player action. */
  resume(): void {
    if (this.currentStatus !== 'paused') return
    this.currentStatus = 'running'
    this.currentPause = null
  }

  get status(): MatchStatus {
    return this.currentStatus
  }

  get pauseReason(): PauseReason | null {
    return this.currentPause
  }

  get score(): number {
    return this.currentScore
  }

  get timeLeftSeconds(): number {
    return Math.max(0, this.world.config.match.durationSeconds - this.world.time)
  }

  get result(): MatchResult | null {
    return this.currentResult
  }

  private end(reason: EndReason): void {
    this.currentStatus = 'ended'
    this.currentPause = null
    const limit = this.world.config.match.durationSeconds
    this.currentResult = {
      score: this.currentScore,
      // Summing 1/60 s steps drifts (3600 steps = 59.99999999…), and this
      // value is shown and stored: a time-up match lasted exactly its
      // duration, any other is kept to the millisecond.
      durationSeconds: reason === 'time-up' ? limit : Math.round(Math.min(this.world.time, limit) * 1000) / 1000,
      reason,
      seed: this.seed,
      config: this.world.config,
    }
  }
}
