import { expect, test } from '@playwright/test'
import { distance, requireState, startTestMatch, step } from './harness'

// Flow 5 of the brief: Chaser and Shooter behaviour and the spawn interval.
// The player stays still; the enemies act on their own.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'the rules are the same on mobile; one device is enough here')
})

test('enemies spawn at the configured interval, and both kinds appear', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 4 })

  expect((await step(page, 3.95))?.spawned).toBe(0)
  expect((await step(page, 0.1))?.spawned).toBe(1)
  expect((await step(page, 3.9))?.spawned).toBe(1)
  const two = await step(page, 0.1)
  expect(two?.spawned).toBe(2)
  expect(two?.enemies.map((e) => e.kind).sort()).toEqual(['chaser', 'shooter'])
})

test('a Chaser closes in, explodes on contact, and scores nothing', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 10 })
  // Watched from the moment it spawns: one of the first two spawns (10 s, 20 s)
  // is a Chaser, and it may ram within seconds.
  let now = await step(page, 9.95)
  let chaser = now?.enemies.find((e) => e.kind === 'chaser')
  for (let i = 0; i < 50 && !chaser; i++) {
    now = await step(page, 0.25)
    chaser = now?.enemies.find((e) => e.kind === 'chaser')
  }
  if (!now || !chaser) throw new Error('no Chaser spawned')
  const chaserId = chaser.id

  let gap = distance(chaser.position, now.player.position)
  const healthBefore = now.player.health
  let rammed = false
  for (let i = 0; i < 60; i++) {
    now = await step(page, 0.25)
    if (!now) throw new Error('no match')
    const current = now.enemies.find((e) => e.id === chaserId)
    if (!current) {
      rammed = true
      break
    }
    const next = distance(current.position, now.player.position)
    expect(next, 'the Chaser keeps closing in').toBeLessThanOrEqual(gap + 1)
    gap = next
  }

  const end = await requireState(page)
  expect(rammed, 'the Chaser exploded').toBe(true)
  expect(end.player.health).toBeLessThanOrEqual(healthBefore - 25)
  expect(end.score).toBe(0)
})

test('a Shooter closes in and fires once within range', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 10 })
  let now = await step(page, 20.05)
  const shooter = now?.enemies.find((e) => e.kind === 'shooter')
  if (!now || !shooter) throw new Error('no Shooter spawned')
  const startGap = distance(shooter.position, now.player.position)

  let fired = false
  for (let i = 0; i < 80 && !fired; i++) {
    now = await step(page, 0.25)
    if (!now) throw new Error('no match')
    fired = now.projectiles.some((p) => p.side === 'enemy')
  }

  expect(fired, 'the Shooter opened fire').toBe(true)
  const at = now.enemies.find((e) => e.id === shooter.id)
  if (!at) throw new Error('the Shooter is gone')
  expect(distance(at.position, now.player.position)).toBeLessThan(startGap)
})
