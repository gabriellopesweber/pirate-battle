import { expect, test } from '@playwright/test'
import { distance, sampleWhileHolding, startTestMatch, step } from './harness'

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
  // One of the first two spawns (10 s, 20 s) is a Chaser, and it may ram within
  // seconds, so the whole stretch is sampled from just before the first.
  await step(page, 9.95)
  const samples = await sampleWhileHolding(page, [], 25, 0.25)

  const firstSeen = samples.findIndex((s) => s.enemies.some((e) => e.kind === 'chaser'))
  expect(firstSeen, 'a Chaser spawned').toBeGreaterThanOrEqual(0)
  const chaserId = samples.at(firstSeen)?.enemies.find((e) => e.kind === 'chaser')?.id
  const healthBefore = samples.at(firstSeen)?.player.health ?? 0

  let gap = Number.POSITIVE_INFINITY
  let rammedAt = -1
  for (let i = firstSeen; i < samples.length; i++) {
    const now = samples.at(i)
    const chaser = now?.enemies.find((e) => e.id === chaserId)
    if (!now || !chaser) {
      rammedAt = i
      break
    }
    const next = distance(chaser.position, now.player.position)
    expect(next, 'the Chaser keeps closing in').toBeLessThanOrEqual(gap + 1)
    gap = next
  }

  expect(rammedAt, 'the Chaser exploded').toBeGreaterThan(firstSeen)
  const after = samples.at(rammedAt)
  expect(after?.player.health).toBeLessThanOrEqual(healthBefore - 25)
  expect(after?.score).toBe(0)
})

test('a Shooter closes in and fires once within range', async ({ page }) => {
  await startTestMatch(page, { spawnIntervalSeconds: 10 })
  const start = await step(page, 20.05)
  const shooter = start?.enemies.find((e) => e.kind === 'shooter')
  if (!start || !shooter) throw new Error('no Shooter spawned')
  const startGap = distance(shooter.position, start.player.position)

  const samples = await sampleWhileHolding(page, [], 20, 0.25)
  const firing = samples.find((s) => s.projectiles.some((p) => p.side === 'enemy'))

  expect(firing, 'the Shooter opened fire').toBeDefined()
  const at = firing?.enemies.find((e) => e.id === shooter.id)
  if (!firing || !at) throw new Error('the Shooter is gone')
  expect(distance(at.position, firing.player.position)).toBeLessThan(startGap)
})
