import { expect, test } from '@playwright/test'
import { engage, hold, requireState, startTestMatch, step, STEP_SECONDS } from './harness'
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig'

// Flow 4 of the brief: front and side shots, cooldowns, damage applied once,
// and score without duplication — fired with the real keys.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'keyboard-driven; touch controls are covered in touch.spec and controls.spec')
})

const playerShots = (s: { projectiles: { side: string }[] }) => s.projectiles.filter((p) => p.side === 'player')

test('the bow cannon fires one shot, then waits for its cooldown', async ({ page }) => {
  await startTestMatch(page)

  const first = await hold(page, 'Space', STEP_SECONDS)
  expect(first && playerShots(first)).toHaveLength(1)
  expect(first?.weapons.front).toBeGreaterThan(0.3)

  // Held through most of the cooldown: still the one shot.
  await page.keyboard.down('Space')
  const during = await step(page, 0.25)
  expect(during && playerShots(during)).toHaveLength(1)

  // Held past the cooldown: the second shot.
  const after = await step(page, 0.15)
  await page.keyboard.up('Space')
  expect(after && playerShots(after)).toHaveLength(2)
})

test('each broadside fires three parallel shots, on its own cooldown', async ({ page }) => {
  await startTestMatch(page)

  const port = await hold(page, 'KeyQ', STEP_SECONDS)
  expect(port && playerShots(port)).toHaveLength(3)
  // The cooldown comes from the config, so balancing it never breaks this test.
  const { cooldownSeconds } = DEFAULT_GAME_CONFIG.player.broadside
  expect(port?.weapons.left).toBeCloseTo(cooldownSeconds, 2)
  expect(port?.weapons.right).toBe(0)

  // The other side is ready at once: its cooldown is separate.
  const both = await hold(page, 'KeyE', STEP_SECONDS)
  expect(both && playerShots(both)).toHaveLength(6)
})

test('shots damage an enemy once per hit, and sinking it scores exactly one point', async ({ page }) => {
  // One enemy at a time: the first spawns at 10 s, the next only at 20 s.
  await startTestMatch(page, { spawnIntervalSeconds: 10, seed: 3 })
  const now = await step(page, 10.05)
  const target = now?.enemies[0]
  if (!target) throw new Error('no enemy spawned')

  const { healthSeen, sunk } = await engage(page, target.id, 12)

  const end = await requireState(page)
  expect(sunk, 'the target was sunk').toBe(true)
  expect(end.enemies.find((e) => e.id === target.id)).toBeUndefined()
  // Every hit took off exactly one shot's damage (20), never twice.
  for (const health of healthSeen) expect((target.maxHealth - health) % 20).toBe(0)
  expect(end.score).toBe(1)

  // Time passing never recounts the kill.
  const later = await step(page, 2)
  expect(later?.score).toBe(1)
})
