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
  integration (production from `main`, previews on PRs — previews sit behind Vercel's login, so
  production is the only public URL). Live at https://gabriellopesweber-pirate-battle.vercel.app.
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
- [ ] **Weapons and projectiles** — front shot, left/right broadside (3 parallel), per-weapon
  cooldown, speed, damage applied once, lifetime/range, removal on hit/obstacle/exit · **#6**
- [ ] **Enemies and spawner** — Chaser (pursue, ram, explode, no score), Shooter (approach, fire in
  range), both colliding with islands; spawn interval, distribution, safe spawn points · **#7**
- [ ] **Match rules** — timer (60–180 s), score, end by time or death, everything stops at the end,
  clean restart, manual pause and auto-pause on blur/hidden with explicit resume · **#8**
- [ ] **Pixi renderer** — water/islands, ships with damage states, health bars above ships, muzzle
  flash, impacts, explosions; DPR-aware resize with letterboxing · **#9**
- [ ] **Input** — keyboard and touch, simultaneous move + fire, captured only during gameplay,
  no input accumulated while paused · **#10**
- [ ] **React screens** — main menu (Play, Options, controls, tabs), Options with validation and
  persistence, game screen with HUD and pause dialog, result screen with last result persisted ·
  **#11**

## 🟡 Wave 2 — what the evaluator will poke at

- [ ] **Ranking and history API** — typed contracts, Axios client, TanStack Query hooks, MSW
  handlers over a localStorage-backed db, fixtures for other players, ranking scoped by config
  with deterministic tie-break · **#12**
- [ ] **Match registration** — idempotent submit (client-generated match id), pending queue that
  survives failures and refresh, retry, playable while pending · **#13**
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

- [ ] **CI once per change** — the `push: main` trigger re-ran the PR's checks after every merge
  and on docs-only commits; the PR run already tests the merge result · **#24**

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
