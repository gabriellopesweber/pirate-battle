/**
 * Seeded pseudo-random generator. Every random decision in the simulation goes
 * through one of these, so a match is fully reproducible from its seed.
 */
export interface Rng {
  readonly seed: number
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number
  /** Picks a key with probability proportional to its weight. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K
}

// mulberry32: tiny, fast and good enough for gameplay — not for cryptography.
export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    seed,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
      const entries = (Object.entries(weights) as [K, number][]).filter(([, weight]) => weight > 0)
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
      const first = entries[0]
      if (!first) throw new Error('weighted() needs at least one positive weight')
      let roll = next() * total
      for (const [key, weight] of entries) {
        roll -= weight
        if (roll < 0) return key
      }
      return first[0]
    },
  }
}

/** A fresh seed for normal play; tests pass an explicit one instead. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000)
}
