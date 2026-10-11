import { expect, test } from '@playwright/test'
import { aimAt, angleDelta, distance, hold, startTestMatch, step } from './harness'

// Flow 3 of the brief: movement, rotation, arena bounds and islands — driven
// by the real keyboard, observed through the test instrumentation.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'keyboard-driven; touch controls are covered in touch.spec and controls.spec')
})

test('sails forward along its heading, and only while the key is held', async ({ page }) => {
  const start = await startTestMatch(page)

  const sailing = await hold(page, 'KeyW', 1)
  if (!sailing) throw new Error('no match')

  const moved = distance(start.player.position, sailing.player.position)
  expect(moved).toBeGreaterThan(10)
  const direction = Math.atan2(
    sailing.player.position.y - start.player.position.y,
    sailing.player.position.x - start.player.position.x,
  )
  expect(Math.abs(angleDelta(start.player.heading, direction))).toBeLessThan(0.01)

  // Released: it coasts to a stop instead of accelerating further.
  const after = await step(page, 3)
  expect(after?.player.speed).toBeLessThan(sailing.player.speed)
})

test('turns both ways', async ({ page }) => {
  const start = await startTestMatch(page)

  const right = await hold(page, 'KeyD', 0.5)
  const back = await hold(page, 'KeyA', 1)

  expect(angleDelta(start.player.heading, right?.player.heading ?? 0)).toBeGreaterThan(0.2)
  expect(angleDelta(right?.player.heading ?? 0, back?.player.heading ?? 0)).toBeLessThan(-0.2)
})

/** Distance from a point to a box; 0 inside it. */
const toBox = (p: { x: number; y: number }, b: { left: number; top: number; right: number; bottom: number }) =>
  Math.hypot(Math.max(b.left - p.x, 0, p.x - b.right), Math.max(b.top - p.y, 0, p.y - b.bottom))

test('sailing straight at an island reaches its coast and slides along it, never onto land', async ({ page }) => {
  const start = await startTestMatch(page, { spawnIntervalSeconds: 10 })
  const islands = [...start.arena.islands].sort(
    (a, b) => toBox(start.player.position, a) - toBox(start.player.position, b),
  )
  const island = islands.at(0)
  if (!island) throw new Error('the arena has no island')
  await aimAt(page, { x: (island.left + island.right) / 2, y: (island.top + island.bottom) / 2 })

  // Sampled along the way: hitting a coast at an angle slides the ship along it
  // (by design), so the check is the whole path, not where it ends.
  let closest = Number.POSITIVE_INFINITY
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 40; i++) {
    const now = await step(page, 0.1)
    if (!now) throw new Error('no match')
    expect(now.player.onLand, `on land after ${String((i + 1) / 10)} s`).toBe(false)
    closest = Math.min(closest, toBox(now.player.position, island))
  }
  await page.keyboard.up('KeyW')

  // It reached the coast — as close as its hull allows — without crossing it.
  expect(closest).toBeGreaterThanOrEqual(start.player.radius - 1)
  expect(closest).toBeLessThan(start.player.radius + 4)
})

test('sailing straight at the arena edge stops at it', async ({ page }) => {
  const start = await startTestMatch(page, { spawnIntervalSeconds: 10 })
  // Due west, along the start's row, where no island stands in the way.
  await aimAt(page, { x: 0, y: start.player.position.y })

  const end = await hold(page, 'KeyW', 12)
  if (!end) throw new Error('no match')

  expect(end.player.position.x).toBeGreaterThanOrEqual(end.player.radius - 1)
  expect(end.player.position.x).toBeLessThan(end.player.radius + 8)
})
