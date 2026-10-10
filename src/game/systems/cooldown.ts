// Float drift tolerance when a cooldown counts down in 1/60 s steps.
const EPSILON = 1e-9

/** Seconds until a weapon can fire again; 0 means ready. */
export interface Cooldown {
  remaining: number
}

export const readyCooldown = (): Cooldown => ({ remaining: 0 })

/** Counts a cooldown down by one step. */
export function tickCooldown(cooldown: Cooldown, dt: number): void {
  cooldown.remaining = Math.max(0, cooldown.remaining - dt)
}

export const isReady = (cooldown: Cooldown): boolean => cooldown.remaining <= EPSILON
