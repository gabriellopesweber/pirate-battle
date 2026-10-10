// Tolerates float drift when summing 1/60 steps, so 1 s of real time is
// exactly 60 steps instead of occasionally 59.
const EPSILON = 1e-9

export interface FixedStepLoopOptions {
  stepSeconds: number
  maxStepsPerFrame: number
  step: (stepSeconds: number) => void
}

/**
 * Turns variable frame times into a whole number of equal simulation steps.
 *
 * Rendering can run at 30, 60 or 144 Hz; the rules always advance in
 * `stepSeconds` slices, so movement, damage and spawns do not depend on the
 * frame rate. Leftover time is kept in an accumulator for the next frame.
 */
export class FixedStepLoop {
  private readonly stepSeconds: number
  private readonly maxStepsPerFrame: number
  private readonly step: (stepSeconds: number) => void
  private accumulator = 0
  private stepCount = 0
  private paused = false

  constructor({ stepSeconds, maxStepsPerFrame, step }: FixedStepLoopOptions) {
    if (!(stepSeconds > 0)) throw new Error('stepSeconds must be positive')
    if (!(maxStepsPerFrame >= 1)) throw new Error('maxStepsPerFrame must be at least 1')
    this.stepSeconds = stepSeconds
    this.maxStepsPerFrame = maxStepsPerFrame
    this.step = step
  }

  /** Feeds real elapsed time and runs the steps it covers. Returns how many ran. */
  advance(realSeconds: number): number {
    if (this.paused || !Number.isFinite(realSeconds) || realSeconds <= 0) return 0

    this.accumulator += realSeconds
    let ran = 0
    while (this.accumulator + EPSILON >= this.stepSeconds && ran < this.maxStepsPerFrame) {
      this.runStep()
      this.accumulator -= this.stepSeconds
      ran++
    }
    // After a stall (tab throttled, debugger, slow device) drop the backlog
    // instead of trying to catch up — catching up would make the next frame
    // even slower, and the game would appear to fast-forward.
    if (this.accumulator + EPSILON >= this.stepSeconds) this.accumulator = 0
    if (this.accumulator < 0) this.accumulator = 0
    return ran
  }

  /** Runs exactly `count` steps, ignoring pause and real time. Test clock control. */
  stepManually(count = 1): void {
    for (let i = 0; i < count; i++) this.runStep()
  }

  pause(): void {
    this.paused = true
  }

  /** Resumes without catching up: time spent paused never reaches the simulation. */
  resume(): void {
    this.paused = false
    this.accumulator = 0
  }

  get isPaused(): boolean {
    return this.paused
  }

  /** Simulation time elapsed, independent of real time. */
  get elapsedSeconds(): number {
    return this.stepCount * this.stepSeconds
  }

  get steps(): number {
    return this.stepCount
  }

  /** Fraction of a step left in the accumulator, in [0, 1). For render interpolation. */
  get alpha(): number {
    return Math.min(this.accumulator / this.stepSeconds, 1 - EPSILON)
  }

  private runStep(): void {
    this.step(this.stepSeconds)
    this.stepCount++
  }
}
