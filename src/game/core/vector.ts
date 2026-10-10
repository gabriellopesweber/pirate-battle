// World space: x grows right, y grows down (screen convention). An angle of 0
// points along +x and positive angles turn clockwise on screen.

export interface Vec2 {
  x: number
  y: number
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y })

/** Unit vector pointing along `angle`. */
export const fromAngle = (angle: number): Vec2 => ({ x: Math.cos(angle), y: Math.sin(angle) })

export const length = (v: Vec2): number => Math.hypot(v.x, v.y)

export const distanceSq = (a: Vec2, b: Vec2): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

export const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSq(a, b))

/** Angle from `from` to `to`. */
export const angleTo = (from: Vec2, to: Vec2): number => Math.atan2(to.y - from.y, to.x - from.x)

/** Normalises an angle into (-π, π]. */
export function wrapAngle(angle: number): number {
  const wrapped = angle % (2 * Math.PI)
  if (wrapped > Math.PI) return wrapped - 2 * Math.PI
  if (wrapped <= -Math.PI) return wrapped + 2 * Math.PI
  return wrapped
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)
