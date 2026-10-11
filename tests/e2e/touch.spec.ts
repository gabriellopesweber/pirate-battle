import { expect, type Page, test } from '@playwright/test'
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
