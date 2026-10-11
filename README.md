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
on touch screens as two thumb clusters — steering bottom left, weapons bottom right; keyboard
controls are listed on screen.

## Gameplay configuration

All balancing numbers live in [`src/game/config/gameConfig.ts`](src/game/config/gameConfig.ts).
The Options screen exposes two of them:

| Option | Default | Limits |
|---|---|---|
| Game session time | 120 s | 60–180 s |
| Enemy spawn time | 3 s | 1–10 s |

Below 1 s the arena fills up to the alive-enemy cap within seconds; above 10 s a short match may
not show both enemy types. Each match uses a snapshot of the options taken when it starts.

## Network scenarios

The ranking and history API is a mock served by MSW — in development and in the deployed build. Its
network conditions are selectable, so every failure the game handles can be reproduced on demand.

**Selecting one:** open **Network scenario** at the foot of the main menu and pick from the list,
or put it in the URL — `?scenario=offline`, optionally with `&seed=42` for the randomness of the
variable latency. The choice is kept across refreshes, and the panel shows the active scenario even
when collapsed. A change applies at once: both tabs refetch and pending registrations are resent.

**Resetting:** **Reset data** in the same panel restores the fixtures and the Success scenario,
clears confirmed and pending registrations and the last result, and reloads.

| Scenario | URL value | What happens |
|---|---|---|
| Success | `success` | Every request answers at once; the ranking has several pages |
| Empty lists | `empty` | Ranking and history answer with no matches |
| Slow | `slow` | Every answer takes about two seconds |
| Variable latency | `jitter` | Each answer takes 0.1–1.5 s, drawn from the seed |
| Out-of-order answers | `out-of-order` | Each read answers after the one sent next |
| Timeout | `timeout` | Every answer arrives after the client's 5 s timeout |
| Connection failure | `offline` | Every request fails to reach the server |
| Server error (500) | `server-error` | Every request gets a 500 |
| Rejected request (400) | `bad-request` | Every request gets a 400 |
| Ranking fails | `ranking-fails` | Only the ranking answers with a 500 |
| History fails | `history-fails` | Only the match history answers with a 500 |
| Timeout after registering | `register-timeout` | The server stores a match but answers its first send too late; resends recover it without a duplicate |
| Unavailable at match end | `register-offline` | Registering fails; the match stays pending until you switch back to Success |

**Reproducing the failures the brief lists:**

- *Ranking or history read failure, loading and retry:* `history-fails` or `ranking-fails`, then
  open the tab — the error explains itself and offers **Try again**; switching back to Success
  recovers
- *Late answers never overwrite newer data:* `out-of-order`, then page through the ranking
- *Timeout after registering, without duplication:* `register-timeout`, then finish a match — the
  result shows **Saved** and the history holds one entry
- *Unavailable at match end, registered after recovery:* `register-offline`, finish a match (the
  result shows it is not saved), then pick Success in the menu — the pending match is sent

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base URL for the ranking and history API (served by MSW) |

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the game is put together and why
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — workflow: issues, branches, commits, pull requests
- [`docs/plans/`](docs/plans) — delivery plan and its status
