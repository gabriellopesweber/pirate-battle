import { expect, type Page, test } from '@playwright/test'
import { startMatch } from './helpers'

// Brief §7: no cut-off in the arena or the HUD, in both orientations on
// mobile, and the layout follows a resize without touching the rules.

const HUD_PARTS = ['Health', 'Pause', 'Restart'] as const

async function bounds(locator: ReturnType<Page['locator']>, name: string) {
  const b = await locator.boundingBox()
  if (!b) throw new Error(`${name} is not rendered`)
  return b
}

async function expectOnScreen(page: Page, locator: ReturnType<Page['locator']>, name: string) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport')
  const b = await bounds(locator, name)
  expect(b.x, `${name} left edge`).toBeGreaterThanOrEqual(0)
  expect(b.y, `${name} top edge`).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width)
  expect(b.y + b.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height)
}

async function expectHudAndArenaOnScreen(page: Page) {
  for (const name of HUD_PARTS) {
    const locator = name === 'Health' ? page.getByRole('meter', { name }) : page.getByRole('button', { name })
    await expectOnScreen(page, locator, name)
  }
  await expectOnScreen(page, page.locator('.hud__counter').first(), 'Score')
  await expectOnScreen(page, page.locator('.hud__counter').last(), 'Time left')
  await expectOnScreen(page, page.locator('canvas'), 'Arena')
}

for (const orientation of ['portrait', 'landscape'] as const) {
  test(`the HUD and the arena fit the screen (${orientation})`, async ({ page, isMobile }) => {
    if (orientation === 'landscape') {
      test.skip(!isMobile, 'desktop has one orientation')
      const size = page.viewportSize()
      if (size) await page.setViewportSize({ width: size.height, height: size.width })
    }
    await startMatch(page)

    await expectHudAndArenaOnScreen(page)
  })
}

test('turning the device keeps the HUD and arena on screen, and the match goes on', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'rotation is a mobile concern')
  await startMatch(page)
  const size = page.viewportSize()
  if (!size) throw new Error('No viewport')

  await page.setViewportSize({ width: size.height, height: size.width })
  await expectHudAndArenaOnScreen(page)
  await page.setViewportSize(size)
  await expectHudAndArenaOnScreen(page)

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

// A phone on its side is only ~400 px tall: every screen's main actions must
// show without scrolling — not under the panel's frame, not off the screen.

/** Whether the control is what a tap at its centre lands on, inside the viewport. */
async function expectReachable(page: Page, locator: ReturnType<Page['locator']>, name: string) {
  await expectOnScreen(page, locator, name)
  const hit = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return top !== null && (top === el || el.contains(top))
  })
  expect(hit, `${name} is covered or scrolled out of its panel`).toBe(true)
}

test('every screen shows its main actions without scrolling on a phone on its side', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a landscape phone is the shortest screen we support')
  test.setTimeout(90_000)
  const size = page.viewportSize()
  if (!size) throw new Error('No viewport')
  await page.setViewportSize({ width: size.height, height: size.width })
  await page.goto('/?test&clock=manual&matchSeed=1')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await expect(button('Play')).toBeVisible({ timeout: 15_000 })

  for (const name of ['Play', 'Options']) await expectReachable(page, button(name), name)
  for (const name of ['Ranking', 'Match History']) await expectReachable(page, page.getByRole('tab', { name }), name)

  await button('Options').click()
  for (const name of ['Game session time', 'Enemy spawn time'])
    await expectReachable(page, page.getByRole('spinbutton', { name }), name)
  for (const name of ['Save', 'Main Menu']) await expectReachable(page, button(name), name)
  await button('Main Menu').click()

  await button('Play').click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await button('Pause').click()
  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expectOnScreen(page, dialog.locator('.panel'), 'Pause panel')
  for (const name of ['Resume', 'Restart', 'Main Menu'])
    await expectReachable(page, dialog.getByRole('button', { name }), name)
  await dialog.getByRole('button', { name: 'Resume' }).click()

  await page.evaluate(() => {
    const game = (window as unknown as { __pirateBattle: { step: (s: number) => void } }).__pirateBattle
    for (let i = 0; i < 120; i++) game.step(1)
  })
  await expect(page.getByRole('heading', { name: /Your ship sank|Battle complete/ })).toBeVisible()
  for (const name of ['Play Again', 'Main Menu']) await expectReachable(page, button(name), name)
})

// Small phones on their side (iPhone SE, Galaxy S8, the smallest still in use):
// nothing in the menu may overlap — the controls card shares the panel with
// the buttons there, so it is far narrower than the screen.
for (const [device, width, height] of [
  ['iPhone SE', 667, 375],
  ['Galaxy S8', 740, 360],
  ['a 568 × 320 phone', 568, 320],
] as const) {
  test(`nothing in the menu overlaps on ${device} on its side`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a phone size')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Match History' }).click()
    // The opened tab's content comes into view: a tap that changes nothing on screen looks broken.
    await expect(page.getByText('No matches yet. Play one to start your history.')).toBeInViewport()

    const overlaps = await page.locator('.screen').evaluate((screen) => {
      // Every piece of text or keycap, as a box; none may cross another or leave its card.
      const parts = [...screen.querySelectorAll('kbd, button, dt, dd, h2, p, th, td, span')].filter(
        (el) => el.children.length === 0 && el.getBoundingClientRect().width > 0,
      )
      const found: string[] = []
      const boxes = parts.map((el) => ({ el, r: el.getBoundingClientRect() }))
      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) {
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
          const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
          if (x > 1 && y > 1) found.push(`"${a.el.textContent}" × "${b.el.textContent}"`)
        }
      for (const card of screen.querySelectorAll<HTMLElement>('.controls-card'))
        if (card.scrollWidth > card.clientWidth + 1) found.push('the controls card overflows its width')
      return found
    })
    expect(overlaps).toEqual([])
  })
}
