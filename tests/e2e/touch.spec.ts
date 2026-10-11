import { type CDPSession, expect, type Page, test } from '@playwright/test'
import { angleDelta, distance, requireState, startTestMatch, step } from './harness'
import { startMatch } from './helpers'

const STEERING = { top: 'Sail forward', left: 'Turn left', right: 'Turn right' } as const
const WEAPONS = { top: 'Fire bow cannon', left: 'Fire port broadside', right: 'Fire starboard broadside' } as const

async function box(page: Page, name: string) {
  const bounds = await page.getByRole('button', { name, exact: true }).boundingBox()
  if (!bounds) throw new Error(`${name} is not rendered`)
  return bounds
}

const centreX = (b: { x: number; width: number }) => b.x + b.width / 2

/** One cluster: the top button above both side buttons and between them. */
async function expectCluster(page: Page, names: { top: string; left: string; right: string }) {
  const [top, left, right] = await Promise.all([box(page, names.top), box(page, names.left), box(page, names.right)])
  expect(top.y + top.height).toBeLessThanOrEqual(Math.min(left.y, right.y) + 1)
  expect(centreX(left)).toBeLessThan(centreX(top))
  expect(centreX(right)).toBeGreaterThan(centreX(top))
}

async function expectAllOnScreen(page: Page) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport')
  for (const name of [...Object.values(STEERING), ...Object.values(WEAPONS)]) {
    const b = await box(page, name)
    expect(b.x, `${name} left edge`).toBeGreaterThanOrEqual(0)
    expect(b.y, `${name} top edge`).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width)
    expect(b.y + b.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height)
  }
}

for (const orientation of ['portrait', 'landscape'] as const) {
  test(`touch controls form two thumb clusters that fit on screen (${orientation})`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch controls only show on touch screens')
    if (orientation === 'landscape') {
      const size = page.viewportSize()
      if (size) await page.setViewportSize({ width: size.height, height: size.width })
    }
    await startMatch(page)

    await expectAllOnScreen(page)
    await expectCluster(page, STEERING)
    await expectCluster(page, WEAPONS)
    // Steering under the left thumb, weapons under the right.
    expect(centreX(await box(page, STEERING.top))).toBeLessThan(centreX(await box(page, WEAPONS.top)))
  })
}

// Touch driving the game: real touches, sent through the browser's input
// pipeline (a synthetic pointer event cannot take pointer capture), held
// while the test clock steps the match.

/** Puts a finger on each named button, in order, and keeps them there. */
async function touchDown(page: Page, cdp: CDPSession, names: string[]) {
  const touchPoints = []
  for (const [id, name] of names.entries()) {
    const b = await box(page, name)
    touchPoints.push({ x: centreX(b), y: b.y + b.height / 2, id })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints })
}

async function liftAll(cdp: CDPSession) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Holds the buttons for `seconds` of game time, then lifts every finger. */
async function holdTouch(page: Page, cdp: CDPSession, names: string[], seconds: number) {
  await touchDown(page, cdp, names)
  await step(page, seconds)
  await liftAll(cdp)
  return requireState(page)
}

test.describe('touch drives the ship', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'touch controls only show on touch screens')
  })

  test('holding Sail forward moves the ship along its heading, and only while held', async ({ page }) => {
    const start = await startTestMatch(page, { spawnIntervalSeconds: 10 })
    const cdp = await page.context().newCDPSession(page)

    const sailing = await holdTouch(page, cdp, [STEERING.top], 1)

    expect(distance(start.player.position, sailing.player.position)).toBeGreaterThan(10)
    const direction = Math.atan2(
      sailing.player.position.y - start.player.position.y,
      sailing.player.position.x - start.player.position.x,
    )
    expect(Math.abs(angleDelta(start.player.heading, direction))).toBeLessThan(0.01)
    const after = await step(page, 3)
    expect(after?.player.speed).toBeLessThan(sailing.player.speed)
  })

  test('the turn buttons turn both ways', async ({ page }) => {
    const start = await startTestMatch(page, { spawnIntervalSeconds: 10 })
    const cdp = await page.context().newCDPSession(page)

    const right = await holdTouch(page, cdp, [STEERING.right], 0.5)
    const left = await holdTouch(page, cdp, [STEERING.left], 1)

    expect(angleDelta(start.player.heading, right.player.heading)).toBeGreaterThan(0.2)
    expect(angleDelta(right.player.heading, left.player.heading)).toBeLessThan(-0.2)
  })

  test('each fire button fires its weapon, and one thumb can sail while the other fires', async ({ page }) => {
    const start = await startTestMatch(page, { spawnIntervalSeconds: 10 })
    const cdp = await page.context().newCDPSession(page)

    const bow = await holdTouch(page, cdp, [STEERING.top, WEAPONS.top], 1 / 60)
    expect(bow.projectiles.filter((p) => p.side === 'player')).toHaveLength(1)
    expect(bow.weapons.front).toBeGreaterThan(0)
    expect(bow.player.speed).toBeGreaterThan(start.player.speed)

    const port = await holdTouch(page, cdp, [WEAPONS.left], 1 / 60)
    expect(port.weapons.left).toBeGreaterThan(0)
    const starboard = await holdTouch(page, cdp, [WEAPONS.right], 1 / 60)
    expect(starboard.weapons.right).toBeGreaterThan(0)
    // Each broadside adds three shots to the one from the bow.
    expect(starboard.projectiles.filter((p) => p.side === 'player')).toHaveLength(7)
  })
})
