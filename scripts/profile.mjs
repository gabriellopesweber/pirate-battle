// @ts-check
// Performance profile of the production build (brief §9): a three-minute
// match measured frame by frame, a stress run with the densest spawning the
// options allow, and memory across start/play/exit cycles — the five the brief
// asks for, then ten more and a heap-snapshot comparison to tell a cache that
// settles from a leak that keeps growing.
//
//   pnpm build && pnpm profile
//
// Runs in the installed Google Chrome with a visible window, so the GPU does
// the rendering — headless Chromium renders WebGL in software and would
// measure the CPU instead. Writes raw data to docs/performance/raw/.
//
// Plain JavaScript, type-checked through JSDoc (`checkJs` in
// tsconfig.node.json), so Node runs it without type-stripping flags.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { chromium } from '@playwright/test'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').CDPSession} CDPSession
 * @typedef {import('@playwright/test').Browser} Browser
 * @typedef {import('node:child_process').ChildProcess} ChildProcess
 * @typedef {import('../src/testing/snapshot.ts').MatchSnapshot} MatchSnapshot
 * @typedef {{ sessionSeconds: number, spawnIntervalSeconds: number }} MatchOptions
 * @typedef {{ time: number, enemies: number, projectiles: number, total: number, status: string }} EntitySample
 * @typedef {{ frames: number[], entities: EntitySample[], running: boolean }} Recording
 * @typedef {Window & {
 *   __pirateBattle: { state: () => MatchSnapshot | null },
 *   __pilot?: ReturnType<typeof setInterval>,
 *   __sampler?: ReturnType<typeof setInterval>,
 *   __recording?: Recording,
 * }} ProfiledWindow
 */

const PORT = 4731
const BASE = `http://localhost:${String(PORT)}`
const OUT = 'docs/performance/raw'
const VIEWPORT = { width: 1920, height: 1080 }
/** The measured match: three minutes, at the gentlest spawn rate, so the pilot lasts it. */
const MATCH = { sessionSeconds: 180, spawnIntervalSeconds: 10 }
/** The stress run: the densest spawning the options allow, until the ship sinks. */
const STRESS = { sessionSeconds: 180, spawnIntervalSeconds: 1 }
const CYCLES = 15
/** The snapshot comparison runs between these cycles. */
const SNAPSHOT_AFTER = [5, 15]
const CYCLE_PLAY_SECONDS = 15
const SEEDS = 8

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
/** @param {number} value */
const round = (value) => Math.round(value * 100) / 100

/**
 * Stops the preview server and its children (on Windows `kill` leaves vite running behind the shell).
 * @param {ChildProcess} server
 */
function stop(server) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}

async function startPreview() {
  const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return server
    } catch {
      // not up yet
    }
    await sleep(500)
  }
  stop(server)
  throw new Error('vite preview did not start — run `pnpm build` first')
}

/** In the page: fights like a player — aims at the nearest enemy, fires, closes in. */
function startPilot() {
  const w = /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window))
  /** @param {'keydown' | 'keyup'} type @param {string} code */
  const key = (type, code) => {
    window.dispatchEvent(new KeyboardEvent(type, { code }))
  }
  /** @type {Set<string>} */
  const held = new Set()
  /** @param {string[]} codes */
  const hold = (codes) => {
    for (const code of held) if (!codes.includes(code)) key('keyup', code)
    for (const code of codes) if (!held.has(code)) key('keydown', code)
    held.clear()
    for (const code of codes) held.add(code)
  }
  w.__pilot = setInterval(() => {
    const now = w.__pirateBattle.state()
    if (!now || now.status !== 'running') {
      hold([])
      return
    }
    const { position, heading } = now.player
    let target = null
    let best = Infinity
    for (const enemy of now.enemies) {
      const gap = Math.hypot(enemy.position.x - position.x, enemy.position.y - position.y)
      if (gap < best) {
        best = gap
        target = enemy.position
      }
    }
    if (!target) {
      hold([])
      return
    }
    const wanted = Math.atan2(target.y - position.y, target.x - position.x)
    const delta = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading))
    const codes = ['Space']
    if (Math.abs(delta) > 0.05) codes.push(delta > 0 ? 'KeyD' : 'KeyA')
    if (best > 300) codes.push('KeyW')
    hold(codes)
  }, 100)
}

/** In the page: records every frame's timestamp and, each second, the entities on the field. */
function startRecorder() {
  const w = /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window))
  /** @type {Recording} */
  const recording = { frames: [], entities: [], running: true }
  w.__recording = recording
  /** @param {number} t */
  const onFrame = (t) => {
    if (!recording.running) return
    recording.frames.push(t)
    requestAnimationFrame(onFrame)
  }
  requestAnimationFrame(onFrame)
  w.__sampler = setInterval(() => {
    const now = w.__pirateBattle.state()
    if (!now) return
    recording.entities.push({
      time: now.time,
      enemies: now.enemies.length,
      projectiles: now.projectiles.length,
      total: 1 + now.enemies.length + now.projectiles.length,
      status: now.status,
    })
  }, 1000)
}

/** In the page: stops the pilot and the recorder, and hands the recording back. */
function stopRecording() {
  const w = /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window))
  clearInterval(w.__pilot)
  clearInterval(w.__sampler)
  const recording = w.__recording ?? { frames: [], entities: [], running: false }
  recording.running = false
  return recording
}

/** @param {number[]} stamps */
function frameStats(stamps) {
  const deltas = stamps.slice(1).map((t, i) => t - (stamps[i] ?? t))
  const sorted = [...deltas].sort((a, b) => a - b)
  /** @param {number} q */
  const percentile = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
  const first = stamps[0] ?? 0
  const elapsed = ((stamps.at(-1) ?? first) - first) / 1000
  /** @type {number[]} */
  const perSecond = []
  for (let s = 0, i = 0; s < Math.floor(elapsed); s++) {
    const end = first + (s + 1) * 1000
    let n = 0
    while (i < stamps.length && (stamps[i] ?? Infinity) < end) {
      n++
      i++
    }
    perSecond.push(n)
  }
  return {
    seconds: round(elapsed),
    frames: stamps.length,
    averageFps: round((stamps.length - 1) / elapsed),
    frameTimeMs: {
      median: round(percentile(0.5)),
      p95: round(percentile(0.95)),
      p99: round(percentile(0.99)),
      max: round(sorted.at(-1) ?? 0),
    },
    framesOver33ms: deltas.filter((d) => d > 33.4).length,
    lowestSecondFps: Math.min(...perSecond),
    fpsPerSecond: perSecond,
  }
}

/** @param {EntitySample[]} samples */
function entityStats(samples) {
  const running = samples.filter((s) => s.status === 'running')
  return {
    max: Math.max(...running.map((s) => s.total)),
    average: round(running.reduce((sum, s) => sum + s.total, 0) / running.length),
    maxEnemies: Math.max(...running.map((s) => s.enemies)),
    maxProjectiles: Math.max(...running.map((s) => s.projectiles)),
    perSecond: running.map(({ time, enemies, projectiles, total }) => ({
      time: Math.round(time),
      enemies,
      projectiles,
      total,
    })),
  }
}

/** @param {Browser} browser @param {Page} page */
async function environment(browser, page) {
  const gpu = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  })
  const screen = await page.evaluate(() => ({
    viewport: `${String(innerWidth)} × ${String(innerHeight)}`,
    devicePixelRatio,
  }))
  return {
    date: new Date().toISOString(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model.trim() ?? 'unknown',
    logicalCores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    browser: `Google Chrome ${browser.version()}`,
    gpu,
    ...screen,
    build: 'production (`pnpm build`, served by `vite preview`)',
  }
}

/** @param {Page} page @param {number} seed @param {MatchOptions} options */
async function openGame(page, seed, options) {
  await page.goto(`${BASE}/?test&matchSeed=${String(seed)}`)
  await page.evaluate((saved) => {
    localStorage.setItem('pirate-battle:options', JSON.stringify(saved))
  }, options)
  await page.reload()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
}

/** @param {Page} page */
async function play(page) {
  await page.getByRole('button', { name: 'Play' }).click()
  await page.locator('canvas').waitFor()
  await page.waitForFunction(() => /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window)).__pirateBattle.state() !== null)
  await page.evaluate(startPilot)
}

/** @param {Page} page */
async function recordUntilOver(page) {
  await page.evaluate(startRecorder)
  await page
    .waitForFunction(
      () => /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window)).__pirateBattle.state()?.status !== 'running',
      null,
      { timeout: 240_000, polling: 1000 },
    )
    .catch(() => undefined)
  const recording = await page.evaluate(stopRecording)
  const facts = (await page.locator('.result__facts').textContent().catch(() => '')) ?? ''
  return { recording, endedBy: facts.includes('Time up') ? 'time up' : 'sunk' }
}

/**
 * A full three-minute match; a seed whose ship sinks first is replaced by the next.
 * @param {Page} page
 */
async function threeMinuteMatch(page) {
  const attempts = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    await openGame(page, seed, MATCH)
    await play(page)
    const { recording, endedBy } = await recordUntilOver(page)
    const lastedSeconds = Math.round(recording.entities.at(-1)?.time ?? 0)
    attempts.push({ seed, endedBy, lastedSeconds })
    console.log(`  seed ${String(seed)}: ${endedBy} after ${String(lastedSeconds)} s`)
    if (endedBy === 'time up') {
      return { options: MATCH, seed, attempts, frames: frameStats(recording.frames), entities: entityStats(recording.entities) }
    }
  }
  return { options: MATCH, attempts, error: 'no seed lasted the full match' }
}

/**
 * The densest spawning the options allow, played until the ship sinks.
 * @param {Page} page
 */
async function stressRun(page) {
  await openGame(page, 1, STRESS)
  await play(page)
  const { recording, endedBy } = await recordUntilOver(page)
  return {
    options: STRESS,
    seed: 1,
    endedBy,
    lastedSeconds: Math.round(recording.entities.at(-1)?.time ?? 0),
    frames: frameStats(recording.frames),
    entities: entityStats(recording.entities),
  }
}

/** @param {CDPSession} cdp @param {Page} page @param {string} label @param {{ game: number, external: number }} [requests] */
async function memorySample(cdp, page, label, requests) {
  await cdp.send('HeapProfiler.collectGarbage')
  await sleep(500)
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  /** @type {Record<string, number>} */
  const m = Object.fromEntries(metrics.map(({ name, value }) => [name, value]))
  const sample = {
    label,
    jsHeapUsedMb: round((m.JSHeapUsedSize ?? 0) / 1024 ** 2),
    // Every node the renderer keeps alive, attached or not…
    domNodes: m.Nodes ?? 0,
    // …and the ones actually in the page.
    nodesInDocument: await page.evaluate(() => document.getElementsByTagName('*').length),
    eventListeners: m.JSEventListeners ?? 0,
    canvases: await page.locator('canvas').count(),
    // Requests the page made during the cycle: the game's, and any from
    // elsewhere (an antivirus script injected into every page went through the
    // mock API's service worker on the measuring machine).
    requests,
  }
  console.log(
    `  ${label}: ${String(sample.jsHeapUsedMb)} MB heap, ${String(sample.domNodes)} nodes (${String(sample.nodesInDocument)} in the page), ${String(sample.eventListeners)} listeners, ${String(sample.canvases)} canvases`,
  )
  return sample
}

/**
 * Live objects by constructor name, from a heap snapshot taken over the
 * DevTools protocol: what the page holds, counted, so two snapshots can be
 * compared for whatever keeps growing.
 * @param {CDPSession} cdp
 */
async function heapCounts(cdp) {
  /** @type {string[]} */
  const chunks = []
  /** @param {{ chunk: string }} event */
  const onChunk = ({ chunk }) => {
    chunks.push(chunk)
  }
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  /** @type {{ snapshot: { meta: { node_fields: string[], node_types: [string[]] } }, nodes: number[], strings: string[] }} */
  const snapshot = JSON.parse(chunks.join(''))
  const fields = snapshot.snapshot.meta.node_fields
  const types = snapshot.snapshot.meta.node_types[0]
  const typeAt = fields.indexOf('type')
  const nameAt = fields.indexOf('name')
  const sizeAt = fields.indexOf('self_size')
  /** @type {Map<string, { count: number, bytes: number }>} */
  const counts = new Map()
  for (let i = 0; i < snapshot.nodes.length; i += fields.length) {
    const type = types[snapshot.nodes[i + typeAt] ?? 0]
    if (type !== 'object' && type !== 'closure' && type !== 'array') continue
    const name = `${type}:${snapshot.strings[snapshot.nodes[i + nameAt] ?? 0] ?? '?'}`
    const entry = counts.get(name) ?? { count: 0, bytes: 0 }
    entry.count++
    entry.bytes += snapshot.nodes[i + sizeAt] ?? 0
    counts.set(name, entry)
  }
  return counts
}

/**
 * What grew between two snapshots, largest growth first.
 * @param {Map<string, { count: number, bytes: number }>} before
 * @param {Map<string, { count: number, bytes: number }>} after
 */
function heapGrowth(before, after) {
  return [...after]
    .map(([name, { count, bytes }]) => ({
      name,
      count: count - (before.get(name)?.count ?? 0),
      kb: round((bytes - (before.get(name)?.bytes ?? 0)) / 1024),
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 15)
}

/** @param {Page} page */
async function memoryCycles(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await openGame(page, 1, MATCH)
  const samples = [await memorySample(cdp, page, 'menu, before any match')]
  const requests = { game: 0, external: 0 }
  page.on('request', (request) => {
    if (request.url().startsWith(BASE)) requests.game++
    else requests.external++
  })
  /** @type {Map<number, Map<string, { count: number, bytes: number }>>} */
  const snapshots = new Map()
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    requests.game = 0
    requests.external = 0
    await play(page)
    await sleep(CYCLE_PLAY_SECONDS * 1000)
    await page.evaluate(stopRecording)
    const status = await page.evaluate(
      () => /** @type {ProfiledWindow} */ (/** @type {unknown} */ (window)).__pirateBattle.state()?.status,
    )
    if (status === 'running') {
      await page.getByRole('button', { name: 'Pause' }).click()
      await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
    } else {
      await page.getByRole('button', { name: 'Main Menu' }).click()
    }
    await page.getByRole('button', { name: 'Play' }).waitFor()
    samples.push(await memorySample(cdp, page, `menu, after cycle ${String(cycle)}`, { ...requests }))
    if (SNAPSHOT_AFTER.includes(cycle)) snapshots.set(cycle, await heapCounts(cdp))
  }
  const [from, to] = SNAPSHOT_AFTER
  const before = snapshots.get(from ?? 0)
  const after = snapshots.get(to ?? 0)
  const growth = before && after ? heapGrowth(before, after) : []
  console.log(`  grew between cycles ${String(from)} and ${String(to)}:`, growth.slice(0, 8))
  return {
    cycles: CYCLES,
    playSecondsPerCycle: CYCLE_PLAY_SECONDS,
    options: MATCH,
    samples,
    heapGrowthBetweenCycles: { from, to, topGrowth: growth },
  }
}

const server = await startPreview()
// Every host but localhost fails to resolve: the game needs nothing from the
// network (its API is mocked in the page), and scripts injected into every page
// by other software — an antivirus did, on the measuring machine — would
// otherwise run, and send their requests through the mock API's service worker.
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
})
try {
  const page = await browser.newPage({ viewport: VIEWPORT })
  await openGame(page, 1, MATCH)
  const env = await environment(browser, page)
  console.log(env)
  console.log('three-minute match…')
  const match = await threeMinuteMatch(page)
  console.log('stress run…')
  const stress = await stressRun(page)
  console.log('memory cycles…')
  const memory = await memoryCycles(page)
  mkdirSync(OUT, { recursive: true })
  /** @param {string} name @param {unknown} data */
  const write = (name, data) => {
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 2) + '\n')
  }
  write('environment', env)
  write('match', match)
  write('stress', stress)
  write('memory', memory)
  console.log(`raw data written to ${OUT}/`)
} finally {
  await browser.close()
  stop(server)
}
