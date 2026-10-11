# Plan: deliver Pirate Battle — a playable, tested and deployed naval shooter

> Source: the Pirate Battle challenge brief (React, TypeScript, PixiJS, TanStack Query, Axios, MSW,
> Playwright). Deadline: **2026-10-12 09:25 (BRT)** — two days from 2026-10-10 09:25.
> Scope: everything the brief scores. What gets cut is written down below, never dropped silently.

> **Status: 🚧 in progress.** Epic **#1** with 19 sub-issues (#2–#20). Project scaffold and CI
> workflow in place; deployed to Vercel (#2 ✅).

## Legend

✅ done · 🚧 in progress · 🔲 pending · ❓ blocked by a decision

Priority is **consequence, not effort** — "what happens to the evaluation if this never ships?":

| Label | Wave | Meaning |
|---|---|---|
| `p1` | 🔴 | the game is not playable, not deployed, or a mandatory rule is broken |
| `p2` | 🟡 | a scored requirement the evaluator will check explicitly |
| `p3` | 🟢 | polish — improves the impression, nobody fails without it |

## What exists today

- Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- PixiJS 8, TanStack Query 5, Axios, MSW (worker in `public/`), Playwright (desktop + mobile
  Chromium), Vitest for pure rules, ESLint with `strictTypeChecked`
- Folder layout described in `ARCHITECTURE.md`; no game code yet

## 🔴 Wave 1 — playable, deployed, and honest about its rules

- [x] **Tooling, CI and deploy** — lint/typecheck/unit/build/E2E in GitHub Actions; Vercel Git
  integration deploying `main` only (#27). Live at https://gabriellopesweber-pirate-battle.vercel.app.
  Smoke E2E guards render and SPA fallback · **#2** (PR #21)
- [x] **Asset pipeline** — provided assets kept unmodified in `assets/` (unused individual PNGs,
  vector sources and reference images left out, documented); build script converts the ships XML,
  grids the tilesheet and copies UI and sounds into a git-ignored `public/game/`; progress bar,
  accessible error and retry. Ships stay 1× because the provided "retina" ships sheet is not 2×.
  Failure is tested by aborting the real request in Playwright instead of an in-app hook. The
  gate sits on the home page until the screen flow (#11) moves it in front of combat · **#3**
- [x] **Gameplay config and simulation core** — typed, centralised config with a deep-frozen
  per-match snapshot; option limits (60–180 s, 1–10 s); fixed-timestep loop with step cap,
  pause without catch-up and manual stepping; seeded RNG; entity stores with deferred removal.
  Vector math deferred to #5, where movement first needs it · **#4**
- [x] **Player ship** — forward movement with acceleration, rotation both ways, arena bounds,
  island collision against a tile-grid land mask with sliding along coasts; speed drops only on a
  stall. Movement is shared with enemies through `ShipControls`. Arena layout moved into
  `GameConfig.arena` (tiles, islands, player spawn) · **#5**
- [x] **Weapons and projectiles** — front shot, port and starboard broadsides (3 parallel) with
  independent cooldowns; damage applied once and the projectile removed in the same step; removal
  on land, at the arena edge and on expiry; no friendly fire. Added a per-step `GameEvent` list
  (shot, hit, splash, destroyed) as the single channel to rendering, sound and scoring · **#6**
- [x] **Enemies and spawner** — Chaser (pursue, ram, explode, `ram` cause scores nothing), Shooter
  (approach to preferred distance, aimed fire in range); both through the player's `moveShip`, with
  probe-based land avoidance that commits to a detour (an uncommitted version got Chasers pinned
  against coasts). Spawner: interval, alive cap, seeded safe points; the first two spawns are one
  of each type so both always appear · **#7**
- [x] **Match rules** — `Match` over the world: countdown, score from `player-fire` kills, end by
  time or by sinking, every system frozen after the end and while paused, explicit resume, restart
  as a new match. Time-up results store the exact duration (summed steps drift). Focus-loss
  detection is a DOM-free module; wiring it to the browser lands with the game session (#9) ·
  **#8**
- [x] **Pixi renderer** — `GameSession` (synchronous create, idempotent destroy, deferred teardown
  during start-up: one canvas under Strict Mode), scene mapping entities to views, hulls through the
  atlas's four damage stages, fire when badly damaged, health bars clipped as the UI metadata
  describes, time-driven effects that freeze on pause, letterbox, HUD store. Divergences: the arena
  layout changed to islands within 3 × 3 tiles, each drawn as the whole stretched artwork, because
  tile-by-tile islands showed seams; no render interpolation; a temporary HUD until the screens
  (#11). Wiring auto-pause to the browser landed here as planned in #8 · **#9**
- [x] **Input** — `InputState` with per-action holder counts; keyboard bound only while running
  (unbound and reset on pause/end), touch buttons from the atlas sprites with per-button pointer
  capture, controls legend from the same bindings. Added at his request: `R` and a Restart button,
  each starting a fresh session (the brief's "restart creates a new match") · **#10**
- [x] **React screens** — screen state machine; menu (title art, Play, Options, controls, Ranking
  and Match History tabs — content in #12), Options (inline validation, Save disabled while
  invalid, saved to localStorage), HUD from the atlas (health bar clipped as its metadata says,
  score and time counters, pause and restart), pause dialog, result screen restored after a
  refresh; refresh during combat abandons the match. Visual identity follows the brief's reference
  images, built from the UI atlas (`frameImage` cuts frames for CSS). Divergence: the pause dialog
  has no Options button (not required; it would leave combat). The game → result transition is
  E2E-tested once the test clock lands (#15) · **#11**

## 🟡 Wave 2 — what the evaluator will poke at

- [x] **Ranking and history API** — typed contracts validated on every response, one Axios
  instance, a repository that only maps endpoints, TanStack Query options and hooks (retries only
  for timeouts, lost connections and 5xx; refetch when a tab reopens; previous page kept while
  paging), MSW handlers over a localStorage-backed db shared by browser and tests, seeded fixtures
  for other players. Ranking scoped by the saved options; ties go to the earlier match, then the
  match id. Late responses lose to newer data through a revision on every page. The local player
  gets a stable id and name. Built test-first; added component tests (jsdom + Testing Library) as
  a pyramid layer between unit and E2E · **#12**
- [x] **Match registration** — client-generated match id; the server answers 201 for a new match
  and 200 with the stored record for a resend, so every send is safe to repeat. The match is
  queued in localStorage before its first send and leaves only on a confirmed answer; the app
  resends pending matches on start; the result screen shows the status with Try again, also after
  a refresh. Sent as a TanStack Query mutation that invalidates both tabs. A test covers the
  stored-but-answer-lost case (two requests, one entry) · **#13**
- [ ] **Network scenarios** — selectable, reproducible MSW scenarios (empty, paged, slow, jittered,
  out-of-order, timeout, 4xx/5xx, offline at match end) with reset; works on the deployed build ·
  **#14**
- [ ] **E2E harness and gameplay suite** — seeded matches and test clock control; flows 1–9 of the
  brief; desktop and mobile · **#15**
- [ ] **E2E data suite and visual regression** — flows 10–12; baselines for menu, stable arena
  and result · **#16**
- [ ] **Accessibility** — keyboard menus, visible focus, dialog focus trap, labels, contrast,
  accessible errors, semantic live status without per-frame announcements, supported orientation ·
  **#17**
- [ ] **Final README and ARCHITECTURE** — everything section 11 of the brief lists · **#18**

## 🟢 Wave 3 — polish

- [ ] **Sound** — effects and ambience loops from the provided WAVs, mute toggle · **#19**
- [ ] **Performance report** — FPS, p95 frame time and entity count over a 3-minute match;
  memory over 5 start/play/exit cycles; hardware and browser documented · **#20**

## Found along the way

- [x] **CI once per change** — the `push: main` trigger re-ran the PR's checks after every merge
  and on docs-only commits; the PR run already tests the merge result · **#24**
- [x] **Vercel deploys `main` only, with a clean build log** — previews sat behind Vercel's login
  and duplicated what CI checks. The build log showed two warnings: an open-ended
  `engines.node` (Vercel would auto-upgrade Node on the next major — now `>=22 <25`, with CI and
  production on 24), and the asset script's own `--disable-warning` flag, flagged only because the
  line contains the word (the script is now plain JavaScript checked through JSDoc) · **#27**
- [x] **Ships ending a hair inside land** — collision pushed circles out to exactly their radius,
  and rounding left some 1e-12 inside; caught by the enemy tests, fixed with a 1e-6 skin · **#30**
- [x] **Enemies circling behind islands** — with the new layout, local avoidance rules pinned a
  Chaser against a coast or sent it circling below an island; replaced by corner waypoints from a
  one-hop visibility graph re-run each step · **#33**
- [x] **Unit tests next to the code** — moved from the `tests/unit/` mirror into a `test/` folder
  beside each module, so moving or deleting a module shows its test in the same diff; the testing
  principles are written into `CONTRIBUTING.md` · **#37**
- [x] **Spawner sweep timing out under load** — 30 seeds × 30 s of simulation took ~0.5 s alone
  but once passed Vitest's 5 s default with the whole suite running; it got an explicit budget
  with the reason beside it, the sweep unchanged · **#39**

## Suggested sequence

1. Tooling + deploy (an empty page online in the first hours removes the biggest delivery risk)
2. Config + simulation core → player → weapons → enemies → match rules. Pure TypeScript with unit
   tests; the renderer only needs to exist as debug shapes at this point
3. Asset pipeline + renderer + input + screens → **playable on day 1**
4. API + registration + scenarios (they share the MSW db, so they go in this order)
5. E2E suites — the harness lands with the core, the suites last because they freeze behaviour
6. Accessibility, docs, sound, performance — in whatever time is left

Rules before rendering because the brief weighs gameplay at 35 of 100 points and every later
item (E2E, performance) depends on the rules being deterministic.

## Decisions to confirm

- ✅ **React ↔ Pixi integration** — imperative Pixi owned by a `GameSession` class, mounted by
  one React component; React never renders per frame. `@pixi/react` rejected — reasoning in
  `ARCHITECTURE.md`. Decided 2026-10-10.
- ❓ **Branch model** — proposed: `main` is default and production; one branch per issue; PRs
  into `main`. No `develop`, since there is no staging environment.
- ❓ **Mobile orientation** — proposed: landscape only, with a "rotate your device" overlay.

## Deliberately out of scope

_Nothing yet. Anything cut to meet the deadline is listed here with the reason._

## Do not recreate

- `src/game/config` is the single source of balancing numbers — systems read, never hardcode
- The MSW db is shared by dev, tests and the deployed build — one implementation
