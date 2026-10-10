# Pirate Battle

A top-down 2D naval shooter: sail between islands, sink enemy ships and climb the ranking before
the clock runs out. Built with React, TypeScript and PixiJS.

**Live:** https://gabriellopesweber-pirate-battle.vercel.app

> 🚧 **Work in progress.** Controls and gameplay configuration will be documented here as they
> land.

## Stack

| Concern | Technology |
|---|---|
| UI and menus | React 19 |
| Language | TypeScript (strict) |
| Game rendering | PixiJS 8 |
| Remote state (ranking, history) | TanStack Query 5 |
| HTTP client | Axios |
| API mocking | MSW |
| E2E and visual regression | Playwright |
| Unit tests (game rules) | Vitest |
| Build | Vite |

## Setup

Requirements: Node.js 22–24 (CI and production run 24) and pnpm 11.

```bash
pnpm install
pnpm dev
```

Optionally copy `.env.example` to `.env` — the defaults work out of the box.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Generate runtime assets, then start the development server |
| `pnpm assets` | Regenerate `public/game/` from `assets/` (run by `dev` and `build`) |
| `pnpm build` | Type-check and production build |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Unit tests (game rules) |
| `pnpm test:e2e` | Playwright, desktop and mobile Chromium |
| `pnpm test:e2e:update` | Refresh visual baselines |
| `pnpm test:e2e:report` | Open the last HTML report |
| `pnpm check` | lint + typecheck + unit + build |

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Sail forward | `W` / `↑` | forward button |
| Turn left / right | `A` / `←`, `D` / `→` | turn buttons |
| Fire bow cannon | `Space` | bow-cannon button |
| Fire port / starboard broadside | `Q` / `E` | broadside buttons |
| Pause | `P` / `Esc` | Pause button |
| Restart | `R` | Restart button |

Moving and firing work together. Game keys are only captured while a match is running; the
match also pauses on its own when the window loses focus or the tab is hidden. Touch buttons show
on touch screens; keyboard controls are listed on screen.

## Gameplay configuration

All balancing numbers live in [`src/game/config/gameConfig.ts`](src/game/config/gameConfig.ts).
The Options screen exposes two of them:

| Option | Default | Limits |
|---|---|---|
| Game session time | 120 s | 60–180 s |
| Enemy spawn time | 3 s | 1–10 s |

Below 1 s the arena fills up to the alive-enemy cap within seconds; above 10 s a short match may
not show both enemy types. Each match uses a snapshot of the options taken when it starts.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base URL for the ranking and history API (served by MSW) |

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the game is put together and why
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — workflow: issues, branches, commits, pull requests
- [`docs/plans/`](docs/plans) — delivery plan and its status
