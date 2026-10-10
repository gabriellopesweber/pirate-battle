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

Requirements: Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Optionally copy `.env.example` to `.env` — the defaults work out of the box.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Type-check and production build |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Unit tests (game rules) |
| `pnpm test:e2e` | Playwright, desktop and mobile Chromium |
| `pnpm test:e2e:update` | Refresh visual baselines |
| `pnpm test:e2e:report` | Open the last HTML report |
| `pnpm check` | lint + typecheck + unit + build |

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
