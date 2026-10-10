import { describe, expect, it } from 'vitest'
import { FixedStepLoop } from '@/game/core/fixedStepLoop'

const STEP = 1 / 60

function createLoop(maxStepsPerFrame = 5) {
  let position = 0
  const loop = new FixedStepLoop({
    stepSeconds: STEP,
    maxStepsPerFrame,
    step: (dt) => {
      position += 100 * dt
    },
  })
  return { loop, position: () => position }
}

function runFrames(loop: FixedStepLoop, frameSeconds: number, totalSeconds: number) {
  const frames = Math.round(totalSeconds / frameSeconds)
  for (let i = 0; i < frames; i++) loop.advance(frameSeconds)
}

describe('FixedStepLoop', () => {
  it('advances the same amount at 30 Hz and 144 Hz', () => {
    const slow = createLoop()
    const fast = createLoop()

    runFrames(slow.loop, 1 / 30, 1)
    runFrames(fast.loop, 1 / 144, 1)

    expect(slow.loop.steps).toBe(60)
    expect(fast.loop.steps).toBe(60)
    expect(fast.position()).toBeCloseTo(slow.position(), 9)
    expect(slow.position()).toBeCloseTo(100, 9)
  })

  it('keeps leftover time for the next frame', () => {
    const { loop } = createLoop()

    expect(loop.advance(STEP * 1.5)).toBe(1)
    expect(loop.alpha).toBeCloseTo(0.5, 6)
    expect(loop.advance(STEP * 0.5)).toBe(1)
  })

  it('caps steps per frame and drops the backlog after a stall', () => {
    const { loop } = createLoop(5)

    expect(loop.advance(5)).toBe(5)
    expect(loop.advance(STEP)).toBe(1)
  })

  it('does not advance while paused, and does not catch up on resume', () => {
    const { loop, position } = createLoop()

    runFrames(loop, STEP, STEP * 10)
    loop.pause()
    expect(loop.advance(3)).toBe(0)
    loop.resume()

    expect(loop.steps).toBe(10)
    expect(position()).toBeCloseTo(100 * STEP * 10, 9)
    expect(loop.advance(STEP)).toBe(1)
  })

  it('ignores invalid frame times', () => {
    const { loop } = createLoop()

    expect(loop.advance(-1)).toBe(0)
    expect(loop.advance(Number.NaN)).toBe(0)
    expect(loop.advance(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('steps manually while paused, for test clock control', () => {
    const { loop } = createLoop()

    loop.pause()
    loop.stepManually(30)

    expect(loop.elapsedSeconds).toBeCloseTo(0.5, 9)
  })
})
