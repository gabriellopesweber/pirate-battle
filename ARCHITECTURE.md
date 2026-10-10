# Architecture

> 🚧 **Draft.** Sections marked _proposed_ are decisions not yet confirmed. Each section is
> completed in the same pull request that makes it true.

## Principles

1. **The simulation owns the game.** Continuous combat state lives in plain TypeScript — never in
   React state, never in Pixi objects.
2. **One-way flow per frame:** input → simulation step(s) → renderer reads state → UI receives
   low-frequency updates.
3. **Time-based, frame-rate independent.** Fixed timestep with an accumulator; rules never depend
   on FPS.
4. **Deterministic on demand.** A seeded RNG and a controllable clock make every match
   reproducible in tests.
5. **Everything created is destroyed.** Every subsystem exposes `destroy()`, and mounting is
   idempotent, so React Strict Mode's double mount is harmless.

## Layers

```
src/
  app/          React root, providers, screen state machine
  ui/           React screens and components (menus, options, HUD, dialogs)
  game/
    config/     typed gameplay config — the only place balancing numbers live
    core/       loop, clock, RNG, entity storage, events
    entities/   data shapes for ships, projectiles, islands
    systems/    movement, collision, weapons, AI, spawning, match rules
  render/       PixiJS: application, asset loading, views mapped from entities
  input/        keyboard and touch → per-step action state
  api/          Axios client, typed contracts, TanStack Query hooks
  mocks/        MSW handlers, fixtures, persistent mock db, network scenarios
  storage/      local persistence: options, last result, pending registrations
tests/
  unit/         Vitest — pure rules
  e2e/          Playwright — flows and visual baselines
```

Dependency direction: `ui → app → render / input → game`. `game/` imports nothing from React or
Pixi, which is what lets it run under Vitest without a canvas.

Inside `game/`, the match state types (`World`, `PlayerInput`) live in `world/state.ts`, apart from
`world/world.ts`, which builds and steps the world. Systems import the types from `state.ts`;
`world.ts` imports the systems. Keeping the types in `world.ts` created import cycles
(`world → projectiles → world`) that the compiler tolerates but editors resolve as half-built
types while files change. There are no import cycles in `src/`.

## React ↔ PixiJS integration

A `GameSession` class (`src/render/GameSession.ts`) owns the Pixi `Application`, the fixed-step
loop, the `Match`, the scene and the auto-pause listeners. `GameView` creates it in an effect and
destroys it in the cleanup:

- `GameSession.create` is **synchronous** — the session exists at once and Pixi's async `init()`
  runs behind it. So React can destroy it at any moment, including during start-up.
- `destroy()` is idempotent. If it arrives while Pixi is still starting (Strict Mode's first
  unmount, or leaving the screen quickly), the teardown is deferred to the end of `init()`, which
  then never mounts a canvas.
- Teardown removes the ticker callback and the focus listeners, destroys the scene and the Pixi
  application (`removeView`), and keeps the atlas textures, which are shared by every match.
  An E2E test checks that the page holds exactly one canvas under Strict Mode.

The UI subscribes to a small external store (`useSyncExternalStore`, `src/render/hudStore.ts`).
The session calls `publish` every frame, but listeners only run when a displayed value changes —
score, whole seconds, health, match status — so React re-renders a few times per second at most,
never per frame. The store exposes function-typed properties, not methods, because React receives
`subscribe` and `getSnapshot` detached from the object.

**Why not `@pixi/react`.** It maps Pixi objects to JSX, which suits scenes where little changes per
frame. Here dozens of ships, projectiles and effects move every frame: driving them through React
would mean a reconciliation pass per frame, or bypassing React through refs — losing the benefit
while keeping the cost. An explicit class also makes the lifecycle the brief asks for (releasing
the ticker, listeners and textures; surviving Strict Mode) a single, testable `destroy()` instead of
behaviour hidden inside a library. The trade-off is writing the entity → sprite mapping by hand.

## Gameplay configuration

`src/game/config/gameConfig.ts` holds every balancing number — durations, spawn interval and
weights, health, speeds, turn rates, damage, projectile speed/lifetime/radius, cooldowns and the
Shooter's ranges — in one typed `GameConfig`. Systems only read it.

When a match starts, `createMatchConfig(base, options)` applies the player's two options to a
`structuredClone` of the base and **deep-freezes** the result. The match keeps that snapshot for
its whole life, so changing Options mid-match only affects the next match, and no system can
mutate balancing by accident.

## Simulation loop

`FixedStepLoop` (`src/game/core/fixedStepLoop.ts`) converts variable frame times into whole,
equal simulation steps (default 1/60 s):

```
every rendered frame:  accumulator += frame time
                       while accumulator ≥ step and steps this frame < max:
                           simulation.step(step); accumulator -= step
                       draw the latest simulation state
```

The renderer draws the latest step without interpolating between steps (the loop exposes
`alpha` for it). At 60 Hz displays that is exact; on 120–144 Hz displays motion advances in 60 Hz
increments — a known limitation, listed below.

- **Frame-rate independent.** 1 s of real time is 60 steps at 30, 60 or 144 Hz — covered by a
  unit test comparing 30 Hz and 144 Hz runs.
- **No spiral of death.** At most `maxStepsPerFrame` steps run per frame; after a stall the
  backlog is dropped instead of fast-forwarding the game.
- **Pause cannot leak time.** While paused, `advance` runs nothing; `resume` clears the
  accumulator, so time spent paused never reaches the rules.
- **Test clock.** `stepManually(n)` runs exact steps regardless of real time — the hook E2E tests
  use to make combat reproducible.

Randomness goes through a seeded generator (`src/game/core/rng.ts`, mulberry32): the same seed
and the same inputs produce the same match.

Entities live in `EntityStore`s keyed by ids that are never reused within a match. Removal is
**deferred**: a destroyed entity is hidden from lookups and iteration immediately — so it cannot
collide, deal damage or fire later in the same step — and physically removed once per step by
`flush()`.

## Collisions

### Ships against land and the arena edge

The provided island art is built from 64 × 64 sand tiles, so the arena is a **tile grid**: each
island is authored as tile rectangles in `GameConfig.arena` and rasterised once into a land mask
(`src/game/world/arena.ts`). The renderer draws each island over the same boxes, so what the player
sees blocking a ship is what blocks it.

Islands are kept within 3 × 3 tiles. The sand art is a single 3 × 3 island whose nine pieces only
join seamlessly in that arrangement; assembling bigger or 2-wide islands tile by tile showed seams.
Each island is therefore drawn as the whole artwork stretched to its box (see Rendering).

Ships are circles. After each move, `resolveCircleAgainstArena` pushes the circle out of every
overlapping land tile along the line from the tile's closest point to the circle's centre — which
lets ships **slide along a coastline** instead of sticking — then clamps it inside the arena. Two
passes settle inner corners where two tiles push at once.

Speed only drops on a **stall** (less than 25% of the intended travel achieved, i.e. ramming land
nearly head-on). Scaling speed on every contact would compound step after step and glue a ship
that merely grazes a coast.

**No tunnelling:** the fastest ship moves under 3 units per 1/60 s step against a 64-unit tile, so
a ship can never skip over land in one step.

Pushed circles end a 1e-6 **skin** beyond their radius rather than exactly tangent: rounding would
otherwise leave some a hair inside the tile, and the next overlap test would count them as
touching land (#30).

Movement is shared: `moveShip` takes `ShipControls` (thrust, turn), produced by player input or by
enemy AI. Ships only move forward, as the brief specifies.

### Projectiles

Weapons (`src/game/systems/weapons.ts`): the front cannon fires one projectile along the heading;
each broadside fires `projectileCount` parallel projectiles perpendicular to it, spaced along the
hull. Front, port and starboard keep **independent cooldowns**; a held button repeats exactly at
the cooldown rate. Projectiles leave from just outside the hull, so a ship never hits itself.

Every step, `updateProjectiles` moves each projectile and resolves, in order:

1. **a ship of the other side** — player fire hits enemies, enemy fire hits the player, never
   their own side. Damage is applied and the projectile removed **in the same step**, so it
   damages at most one ship, once;
2. **land** — removed with a splash on land;
3. **the arena edge** — removed silently;
4. **expiry** — `projectileLifetimeSeconds` elapsed (range = speed × lifetime), splash in water.

Projectiles move under 8 units per step against ships of 20+ units radius and 64-unit tiles, so
nothing is skipped between steps.

A ship reaching zero health is destroyed by `damageShip`: enemies leave their store at once
(deferred removal hides them for the rest of the step), so a destroyed ship stops colliding,
firing and taking hits immediately — the second and third projectiles of a broadside that killed
it fly on.

## Enemies

Enemy AI (`src/game/systems/enemyAi.ts`) only produces `ShipControls`; enemies move through the
same `moveShip` as the player, so they obey the same speeds, turn rates and island collisions.

- **Chaser** — always under thrust, turns towards the player. On contact it deals
  `contactDamage` and explodes (`resolveRams` in `combat.ts`). The explosion is a `destroyed`
  event with cause `ram`, which scores nothing.
- **Shooter** — approaches until `preferredDistance`, then coasts. While the player is within
  `attackRange` it fires aimed shots at its weapon's cooldown.

**Getting around islands.** While the player is in sight — a ship-wide line to it crosses no land —
an enemy steers straight at it; a ship turns in place, so pointing its bow never collides, and
grazing a coast just slides. When land hides the player, the enemy steers instead to a **corner of
an island**, pushed out by its radius plus a margin: of the corners it can see, the one that
minimises ship → corner → player, preferring corners that see the player (`waypoint` in
`enemyAi.ts`). The choice is re-made every step, so a ship straight behind an island heads for a
near corner, then the far corner comes into view and it chains on. It is a one-hop visibility graph
re-run each step: stateless, so nothing can get stuck in a mode, and it always gets round the
convex islands of this arena.

Two local rules came first and were dropped (#33): "turn away from land ahead" pinned a Chaser
against a coast, and "turn away and commit for half a second" sent one circling below an island
forever — pursuit kept pulling it back into the island. Both were found by tracing a ship step by
step when a test failed.

### Spawning

`updateSpawner` spawns one enemy every `spawn.intervalSeconds` while fewer than `maxAliveEnemies`
are alive. A spawn point is drawn from the seeded RNG and accepted only if it is:

- open water at least `clearance` away from land and from the arena edge;
- at least `minDistanceFromPlayer` from the player — no unavoidable damage on arrival;
- clear of other enemies.

After 40 rejected candidates the spawn is skipped until the next interval; the cadence is never
shortened to make up for it. The **first two spawns are one Chaser and one Shooter**, so both
types appear in every match whatever the weights; later spawns follow `spawn.weights`.

## Match rules

`Match` (`src/game/match/match.ts`) wraps one `World` with the rules of a match: status
(`running` → `paused` ⇄ `running` → `ended`), score and result. Its `step` is the only thing that
advances the world, and it does nothing unless the match is running:

- **Pause freezes everything at once.** There is no separate timer to stop: the countdown is
  world time, cooldowns and spawns count down inside steps, so a paused match skips all of them
  together. Resuming is only ever an explicit player action (`resume()`); a manual pause is not
  overwritten by a later focus loss.
- **Score** is read from the step's events: one point per `destroyed` enemy whose cause is
  `player-fire`. A Chaser's `ram` scores nothing, and a kill cannot be counted twice.
- **End** comes when world time reaches the configured duration (`time-up`) or the player sinks
  (`destroyed`). Events after the player's destruction in the same step are not counted. After
  the end, steps are ignored — nothing moves, fires, takes damage, spawns or scores.
- **Result** records score, active play time, reason, seed and the config snapshot. A `time-up`
  match lasted exactly its duration: summing 1/60 s steps drifts (3600 steps add up to
  59.99999999…), so the duration is stored as configured, and other ends to the millisecond.
- **Restart** creates a new `Match` — a fresh world, nothing carried over.

`watchFocusLoss` (`src/input/autoPause.ts`) reports a window blur or a hidden tab; the game
session turns that into `pause('focus-lost')`. It only pauses — a match never resumes on its own.

## Simulation events

Each step produces a list of `GameEvent`s — `shot`, `hit`, `splash`, `destroyed` — cleared at the
start of the next step. They are the only channel from the rules to everything else: the renderer
turns them into muzzle flashes, impacts and explosions, sound plays from them, and the match
counts score from `destroyed` events whose cause is `player-fire`. A kill is **one event**, so it
cannot be counted twice, and a Chaser exploding on the player (`ram`) is distinguishable from a
kill and does not score.

## Input

`InputState` (`src/input/inputState.ts`) holds what the player is pressing and is read once per
simulation step. Each action counts its holders, so a key and a finger on the same action do not
cancel each other when one lets go.

- **Keyboard** (`keyboard.ts`) maps physical keys (`KeyboardEvent.code`, so WASD works on any
  layout). The session binds it **only while the match is running**: pausing or ending unbinds it
  and resets the input state, so keys never reach the game from a menu or dialog and nothing held
  during a pause acts on resume. Bound keys do not scroll the page; keys typed into a form field
  are ignored. `P`/`Esc` pause, `R` restarts.
- **Touch** (`TouchControls.tsx`): HTML buttons drawn with the provided atlas sprites (round button
  and icons, laid out as the atlas metadata says) through CSS on the same atlas image Pixi already
  loaded. Each button captures its own pointer, so one thumb steers while the other fires. Shown
  on coarse pointers, and only while the match is running.
- The controls legend is generated from the same bindings the keyboard uses.

**Restart** creates a new session with a fresh seed: React's effect cleanup destroys the previous
one through the same teardown Strict Mode exercises, so nothing of the old match survives.

## Rendering

`Scene` (`src/render/scene.ts`) decides nothing. Every frame it maps the world to views — a
`ShipView` per ship, a sprite per projectile — creating a view for a new entity, updating existing
ones and destroying views whose entity is gone; every step it turns events into effects.

- **Arena** (`arenaView.ts`): tiled water and one stretched 3 × 3 island artwork per island box.
  It never changes during a match, so it is drawn once into a texture (`cacheAsTexture`) instead of
  every frame. The island cut is the view's own texture and is destroyed with it.
- **Ships** (`shipView.ts`): hull textures follow the atlas's four damage stages — intact, damaged,
  badly damaged, wreck (`ship_1–24`: six colours × four stages; player blue, Chaser black, Shooter
  red). A fire burns on a badly damaged hull. Hull sprites face down, so a hull is rotated by
  `heading − π/2`.
- **Health bars** (`healthBar.ts`): drawn from the UI atlas the way its metadata describes — the fill
  sprite over the frame, clipped from the left inside `fill_rect`. The clipped fill is a texture
  re-cut only when health changes, so a bar costs nothing between hits.
- **Effects** (`effects.ts`): muzzle flash on `shot`, flash and wood debris on `hit`, a ring on
  `splash`, an explosion on `destroyed`, and a fading wreck where an enemy sank. They advance with
  the time the session passes in — zero while paused — so they freeze with the match.
- **Letterbox:** the world is scaled to fit the canvas at its own aspect ratio and centred, so the
  whole arena is always visible. Re-laid out whenever the canvas size changes.

## Resource management

### Asset pipeline

`assets/` keeps the provided art and sound unmodified; `scripts/build-assets.ts` derives the
runtime files into `public/game/` before every `dev` and `build` (the output is git-ignored, so
source and derived files never drift apart in version control). Provenance, what was left out and
why each conversion exists are in [`assets/README.md`](assets/README.md). In short:

- the ships atlas is a Starling XML that PixiJS cannot read — converted to a Pixi JSON atlas;
- the provided ships "retina" sheet is not actually 2× — ships always load at 1×, or they would be
  drawn at half size on dense screens;
- the tilesheet is a bare 64-unit grid — turned into an atlas with one frame per cell, at 1× and 2×.

### Loading, failure and retry

`loadGameAssets` (`src/render/assets.ts`) loads three atlases — ships, tiles, UI — choosing 2× tiles
and UI when `devicePixelRatio > 1.25`. Textures are loaded **once** and reused by every match.

`AssetGate` keeps combat behind the load: a labelled progress bar while loading, an alert with a
focused **Retry** button on failure. Retrying only re-fetches what failed: PixiJS caches successful
loads and drops failed ones from its cache.

Once an attempt settles, late progress events are ignored. Without that, files still downloading
after another one failed kept reporting progress and flipped the error back to "loading", hiding
Retry — caught by the E2E test that aborts the ships image.

## Local persistence

_Written with Options and match registration._

## Ranking and history integration

_Written with the API: contracts, cache keys, invalidation, pending-registration recovery._

## Balancing decisions and known limitations

- **Islands within 3 × 3 tiles**, six of them, two flanking the player's start as cover — chosen
  so the provided sand art has no seams (see Collisions).
- **No render interpolation:** motion advances in 60 Hz increments on faster displays.
- **Enemy navigation assumes convex islands:** corner waypoints always get around a box, not
  around arbitrary shapes. Every island in this arena is a box.
- **Ships overlap each other:** only ship ↔ land and Chaser ↔ player contacts are resolved.
- **E2E runs two workers:** each renders the game with software WebGL in headless Chromium; more
  in parallel starved each other and pushed Pixi's start-up past assertion timeouts.
