import { describe, expect, it } from 'vitest'
import { createRng } from '@/game/core/rng'

const sample = (seed: number, count: number) => {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => rng.next())
}

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(sample(42, 100)).toEqual(sample(42, 100))
  })

  it('produces different sequences for different seeds', () => {
    expect(sample(1, 10)).not.toEqual(sample(2, 10))
  })

  it('keeps values inside the requested bounds', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const value = rng.range(-3, 5)
      expect(value).toBeGreaterThanOrEqual(-3)
      expect(value).toBeLessThan(5)
      const int = rng.int(1, 6)
      expect(Number.isInteger(int)).toBe(true)
      expect(int).toBeGreaterThanOrEqual(1)
      expect(int).toBeLessThanOrEqual(6)
    }
  })

  it('never picks a zero-weight key and roughly respects the weights', () => {
    const rng = createRng(123)
    const counts = { chaser: 0, shooter: 0, ghost: 0 }
    for (let i = 0; i < 10_000; i++) counts[rng.weighted({ chaser: 3, shooter: 1, ghost: 0 })]++

    expect(counts.ghost).toBe(0)
    expect(counts.chaser / counts.shooter).toBeGreaterThan(2.5)
    expect(counts.chaser / counts.shooter).toBeLessThan(3.5)
  })

  it('rejects weights with nothing positive', () => {
    expect(() => createRng(1).weighted({ a: 0 })).toThrow()
  })
})
