# Performance report

Brief §9: combat performance in an optimised build, **60 FPS as the target**; frame rate, 95th
percentile of frame time and entity count over a three-minute match; memory after five
start/play/exit cycles, investigating continuous growth.

**Result:** the game runs at the display's full **120 FPS** (frame time p95 **8.6 ms**, against
the 16.7 ms a 60 FPS target allows), including at the densest the options allow. Across 15
start/play/exit cycles nothing the game creates is left behind; the small heap growth that
remains is the measuring tool's own.

## How it was measured

```bash
pnpm build && pnpm profile    # scripts/profile.mjs — about 8 minutes
```

The script serves the production build (`vite preview`) and drives **Google Chrome with a
visible window**, so the GPU renders — headless Chromium renders WebGL in software and would
measure the CPU instead. A pilot inside the page plays like a person through the real keyboard
listener: it turns towards the nearest enemy, fires the bow cannon and closes in. The test
instrumentation (`?test`, see `ARCHITECTURE.md`) only reads the match state to count entities;
the clock is the real one. Every host but `localhost` is made unresolvable — see *Memory* for why.

Raw data: [`raw/`](raw) — `environment.json`, `match.json` (with FPS for every second and the
entity count for every second), `stress.json`, `memory.json`; the logs of the three memory runs are
in [`raw/investigation/`](raw/investigation).

## Reference environment

| | |
|---|---|
| Hardware | Laptop, Intel Core i5-1235U (12 logical cores), 16 GB RAM, Intel Iris Xe Graphics (integrated) |
| System | Windows 11 (NT 10.0.26200) |
| Browser | Google Chrome 154.0.8037.98, rendering through ANGLE / Direct3D 11 |
| Resolution | 1920 × 1080 viewport, device pixel ratio 1; the display refreshes at 120 Hz (`requestAnimationFrame` ran at 120 per second) |
| Build | production (`pnpm build`), served by `vite preview` |
| Date | 2026-10-12 |

## Frame rate and entities

| | Three-minute match | Stress run |
|---|---|---|
| Match options | 180 s session, an enemy every **10 s** | an enemy every **1 s** (the minimum) |
| Played | 180.7 s, to the end (time up) | 16.1 s, until the ship sank |
| Frames | 21,677 | 1,929 |
| Average FPS | **119.9** | **119.9** |
| Frame time — median / **p95** / p99 / worst | 8.3 / **8.6** / 8.8 / 41.6 ms | 8.3 / **8.5** / 8.6 / 16.6 ms |
| Frames over 33 ms (a dropped frame at 60 FPS) | 1 | 0 |
| Lowest one-second FPS | 115 | 119 |
| Entities on the field — max / average | 5 / 1.7 | **10** / 7.3 |
| Most enemies at once | 1 | **8** — the game's cap (`maxAliveEnemies`) |
| Most projectiles at once | 3 | 3 |

**Why two runs.** The brief asks for a three-minute match; the pilot only lasts three minutes at
the gentlest spawn rate, and there it sinks each enemy before the next arrives, so the field is
light. The stress run covers the other end: one enemy a second fills the arena to the cap of eight
— the most the game can ever show — before the ship goes down. Both hold the display's 120 Hz;
the one slow frame of the match (41.6 ms) is a single frame in 21,677.

## Memory

Five cycles answer the brief; fifteen tell a cache that settles from a leak that keeps going. Each
cycle starts a match from the menu, plays 15 s, pauses and goes back to the main menu; garbage is
then collected twice through the DevTools protocol and the page is measured. A heap snapshot after
cycles 5 and 15 lists what grew, by constructor.

| After cycle | 0 (menu) | 1 | 2 | 3 | 4 | 5 | 10 | 15 |
|---|---|---|---|---|---|---|---|---|
| JS heap (MB) | 6.49 | 7.97 | 8.18 | 8.31 | 8.40 | 8.54 | 8.95 | 9.08 |
| DOM nodes, alive / in the page | 90 / 47 | 344 / 100 | 344 / 100 | 344 / 100 | 344 / 100 | 344 / 100 | 344 / 100 | 344 / 100 |
| Event listeners | 170 | 193 | 193 | 193 | 193 | 193 | 193 | 193 |
| Canvases | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Requests the page made (game / external) | — | 3 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

- **Nothing of a match survives it.** The canvas is gone after every exit; DOM nodes and listeners
  are flat from the first cycle to the fifteenth. The first cycle's rise happens once: the lazily
  loaded parts of PixiJS arrive then (the 3 requests) and stay for every later match, and the menu
  shown after a match holds 53 more nodes than on first load — the same 53 every time after.
- **The heap settles.** From cycle 5 it grows 0.04 → 0.01 MB per cycle, shrinking, plus one step
  of about 0.3 MB at cycle 9 that recurs at the same cycle in every run. The snapshot comparison
  finds only ~20 KB of objects between cycles 5 and 15 — 32 `Generator`s with their promises — so
  the step is not retained data; recurring at the same point, it looks like the browser compiling
  code that has become hot (not proven).
- **Those 32 objects are the measuring tool's.** A control run made the same Playwright calls for
  15 cycles without starting a match and retained 31.

### What the investigation found

The first full run showed the heap growing about 0.07 MB per cycle, with **190** `Generator`s
retained between cycles 5 and 15. Grouping them by the function that owns them pointed at one
place: the mock API's service-worker client (MSW's `browser` chunk) — its message listener,
`async (event) => { await getWorker() … }`, one per message from the worker.

Counting the page's requests per cycle explained the messages: **the game made none** after the
first cycle; 7–8 per cycle went to `gc.kis.v2.scr.kaspersky-labs.com` — a script the antivirus on
the measuring machine injects into every page, `localhost` included, polling its server. Every one
of those requests went through the mock API's service worker. Pausing the antivirus's web
protection did not stop the injection (`raw/investigation/2-antivirus-paused.log`: same growth,
same external requests).

So the measuring browser now resolves no host but `localhost` — the game needs nothing else.
Isolated: **0 external requests, 32 retained objects instead of 190**, matching the control.

**Lesson for the report's reader:** measured on another machine, software that injects scripts
into pages (antiviruses, some extensions) would show up here as growth that is not the game's;
`pnpm profile` blocks it for that reason.

## Limitations observed

- **One machine.** A laptop with integrated graphics and a 120 Hz display. The game reaches the
  display's rate with room to spare (p95 8.6 ms of an 8.3 ms frame); slower GPUs and higher
  resolutions are not measured.
- **The pilot is a bot.** It fights well enough to last three minutes only at a 10 s spawn
  interval, and it steers straight at the nearest enemy with no avoidance — it pushes against
  islands an enemy hides behind, which a person would sail round. The stress run exists because of
  that.
- **Effects are not counted as entities.** The count is ships and projectiles from the match
  state; muzzle flashes, debris, rings and wrecks are drawn by the renderer and not in the state.
  They are in every frame measured.
- **Memory is measured with garbage collection forced**, so the numbers are what stays alive, not
  the peak.
- **The cycle-9 heap step** is explained as code compilation by its shape, not by a measurement
  that isolates it.

## What came out of it

Two defects were found while preparing this report and fixed under their own issues:

- **#56** — the production build warned that its main chunk was 623 kB. React and the data layer
  now have chunks of their own; the main chunk is 318 kB, with no warning and the limit unchanged.
- **#58** — watching the profiling run showed Shooters parked against islands, firing into the
  land. A Shooter stopped on distance alone, without checking it could see the player. Fixed, with
  a sweep over 25 matches kept as a test: 335 s of stalled Shooters before, none after.

The numbers above were measured after both fixes.
