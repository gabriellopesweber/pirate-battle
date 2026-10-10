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

## React ↔ PixiJS integration

A `GameSession` class owns the Pixi `Application`, the ticker, input listeners and the simulation.
One React component mounts it into a container element and destroys it on unmount, guarding the
async `init()` against Strict Mode's mount → unmount → mount.

The UI subscribes to a small external store (`useSyncExternalStore`) that the session updates only
when a displayed value changes — score, whole seconds, health, match status — so React never
re-renders per frame.

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
render with alpha = accumulator / step
```

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
island is authored as a union of tile rectangles in `GameConfig.arena` and rasterised once into a
land mask (`src/game/world/arena.ts`). The renderer draws the same mask, so what the player sees
blocking a ship is exactly what blocks it.

Ships are circles. After each move, `resolveCircleAgainstArena` pushes the circle out of every
overlapping land tile along the line from the tile's closest point to the circle's centre — which
lets ships **slide along a coastline** instead of sticking — then clamps it inside the arena. Two
passes settle inner corners where two tiles push at once.

Speed only drops on a **stall** (less than 25% of the intended travel achieved, i.e. ramming land
nearly head-on). Scaling speed on every contact would compound step after step and glue a ship
that merely grazes a coast.

**No tunnelling:** the fastest ship moves under 3 units per 1/60 s step against a 64-unit tile, so
a ship can never skip over land in one step.

Movement is shared: `moveShip` takes `ShipControls` (thrust, turn), produced by player input or by
enemy AI. Ships only move forward, as the brief specifies.

## Resource management

_Written with the asset pipeline and renderer._

## Local persistence

_Written with Options and match registration._

## Ranking and history integration

_Written with the API: contracts, cache keys, invalidation, pending-registration recovery._

## Balancing decisions and known limitations

_Filled in as they happen._
