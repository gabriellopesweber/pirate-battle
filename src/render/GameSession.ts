import { Application, Container, type Ticker } from 'pixi.js'
import type { GameConfig } from '@/game/config/gameConfig'
import { FixedStepLoop } from '@/game/core/fixedStepLoop'
import { Match, type MatchResult, type PauseReason } from '@/game/match/match'
import { IDLE_PLAYER_INPUT, type PlayerInput } from '@/game/world/state'
import { watchFocusLoss } from '@/input/autoPause'
import type { GameAssets } from '@/render/assets'
import { createHudStore, type HudSnapshot, type HudStore } from '@/render/hudStore'
import { Scene } from '@/render/scene'

export interface GameSessionOptions {
  container: HTMLElement
  assets: GameAssets
  config: Readonly<GameConfig>
  seed: number
  /** Reads the player's intent once per simulation step. */
  readInput?: () => PlayerInput
  onEnd?: (result: MatchResult) => void
}

/**
 * Owns one match on screen: the Pixi application, the fixed-step loop, the
 * scene, auto-pause and the HUD store.
 *
 * React creates it with `GameSession.create` and calls `destroy` on unmount.
 * `destroy` is idempotent and also cancels a start still in flight, which is
 * what makes React Strict Mode's mount → unmount → mount harmless.
 */
export class GameSession {
  readonly hud: HudStore
  readonly match: Match
  private readonly options: GameSessionOptions
  private readonly app = new Application()
  private readonly world = new Container({ label: 'world' })
  private readonly loop: FixedStepLoop
  private scene: Scene | null = null
  private stopFocusWatch: (() => void) | null = null
  private lastSize = { width: 0, height: 0 }
  private endReported = false
  private destroyed = false
  private started = false

  private constructor(options: GameSessionOptions) {
    this.options = options
    this.match = new Match(options.config, options.seed)
    this.hud = createHudStore(this.snapshot())
    this.loop = new FixedStepLoop({
      stepSeconds: options.config.simulation.stepSeconds,
      maxStepsPerFrame: options.config.simulation.maxStepsPerFrame,
      step: (dt) => {
        this.match.step(this.options.readInput?.() ?? IDLE_PLAYER_INPUT, dt)
        this.scene?.handleEvents(this.match.world.events)
      },
    })
  }

  /**
   * Creates the session at once and mounts its canvas as soon as Pixi is
   * ready. The session exists synchronously, so a caller can destroy it at
   * any point — including before `ready` settles.
   */
  static create(options: GameSessionOptions): GameSession {
    const session = new GameSession(options)
    session.ready = session.init()
    return session
  }

  /** Settles once the canvas is mounted, or once a destroy during start-up has torn it down. */
  ready: Promise<void> = Promise.resolve()

  pause(reason: PauseReason): void {
    this.match.pause(reason)
    if (this.match.status === 'paused') this.loop.pause()
    this.publishHud()
  }

  resume(): void {
    this.match.resume()
    // The loop resumes without catching up on the time spent paused.
    if (this.match.status === 'running') this.loop.resume()
    this.publishHud()
  }

  /** Advances the simulation by exact steps, ignoring real time. Test clock control. */
  advanceSteps(count: number): void {
    this.loop.stepManually(count)
    this.render(0)
  }

  /** Live views and Pixi objects, for leak checks. */
  get diagnostics() {
    return { ...(this.scene?.viewCounts ?? { ships: 0, projectiles: 0, effects: 0 }), destroyed: this.destroyed }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.stopFocusWatch?.()
    this.stopFocusWatch = null
    // Pixi cannot be torn down mid-init; init() does it once ready.
    if (this.started) this.teardown()
  }

  private teardown(): void {
    this.app.ticker.remove(this.tick)
    this.scene?.destroy()
    this.scene = null
    // Atlas textures are shared by every match and stay loaded.
    this.app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false })
  }

  private async init(): Promise<void> {
    const { container } = this.options
    await this.app.init({
      resizeTo: container,
      background: '#1b6f9f',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    })
    this.started = true
    // Destroyed while Pixi was starting (Strict Mode's first unmount, or
    // leaving the screen quickly): tear down now that it is possible.
    if (this.destroyed) {
      this.teardown()
      return
    }

    this.app.canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(this.app.canvas)
    this.scene = new Scene(this.match.world, this.options.assets)
    this.world.addChild(this.scene)
    this.app.stage.addChild(this.world)
    this.layout()
    this.stopFocusWatch = watchFocusLoss({ window, document }, () => {
      this.pause('focus-lost')
    })
    this.app.ticker.add(this.tick)
  }

  private readonly tick = (ticker: Ticker): void => {
    const running = this.match.status === 'running'
    if (running) this.loop.advance(ticker.deltaMS / 1000)
    this.render(running ? ticker.deltaMS / 1000 : 0)
  }

  private render(dt: number): void {
    const { width, height } = this.app.screen
    if (width !== this.lastSize.width || height !== this.lastSize.height) this.layout()
    this.scene?.sync(this.match.world, dt)
    this.publishHud()

    const { result } = this.match
    if (result && !this.endReported) {
      this.endReported = true
      this.options.onEnd?.(result)
    }
  }

  /**
   * Letterboxes the world into the canvas: the whole arena stays visible at
   * its own aspect ratio, centred, whatever the screen shape.
   */
  private layout(): void {
    const { width, height } = this.app.screen
    this.lastSize = { width, height }
    const arena = this.match.world.arena
    const scale = Math.min(width / arena.width, height / arena.height)
    this.world.scale.set(scale)
    this.world.position.set((width - arena.width * scale) / 2, (height - arena.height * scale) / 2)
  }

  private publishHud(): void {
    this.hud.publish(this.snapshot())
  }

  private snapshot(): HudSnapshot {
    const { match } = this
    return {
      status: match.status,
      pauseReason: match.pauseReason,
      score: match.score,
      secondsLeft: Math.ceil(match.timeLeftSeconds - 1e-9),
      health: match.world.player.health,
      maxHealth: match.world.player.maxHealth,
      endReason: match.result?.reason ?? null,
    }
  }
}
