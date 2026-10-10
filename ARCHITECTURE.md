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

## React ↔ PixiJS integration — _proposed_

A `GameSession` class owns the Pixi `Application`, the ticker, input listeners and the simulation.
One React component mounts it into a container element and destroys it on unmount, guarding the
async `init()` against Strict Mode's mount → unmount → mount.

The UI subscribes to a small external store (`useSyncExternalStore`) that the session updates only
when a displayed value changes — score, whole seconds, health, match status — so React never
re-renders per frame.

## Simulation loop

_Written with the simulation core._

## Collisions

_Written with the player ship and projectiles._

## Resource management

_Written with the asset pipeline and renderer._

## Local persistence

_Written with Options and match registration._

## Ranking and history integration

_Written with the API: contracts, cache keys, invalidation, pending-registration recovery._

## Balancing decisions and known limitations

_Filled in as they happen._
