# Arrows

A single-player puzzle game for iPhone. The board is full of arrow-shaped paths. Tap an arrow
whose way out is free and it slides off the board. Clear the board. Every level, daily challenge
and event board is generated on the phone from a seed, so there are infinitely many and everyone
plays the same ones.

What we are building, and why, is in [docs/PRODUCT.md](docs/PRODUCT.md); how it looks is in
[docs/DESIGN.md](docs/DESIGN.md). How the code is put
together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). What comes next, task by task, is in
[docs/PLAN.md](docs/PLAN.md).

## Status

| Area                                              | State                                                                                                                                                                                                                                                                                                                                                   |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/engine`](packages/engine/src/index.ts) | Done for v1: seeded RNG, boards and drawings, generator (partition and peel), solver and difficulty metrics, tiers, level and daily seeds, game state, daily league simulation, tests                                                                                                                                                                   |
| [`apps/game`](apps/game/src/main.ts)              | Playable in the browser in the designed Paper theme (T2, T2b, T3): home screen with the level path, streak and mode cards; SVG board, tap by cell, pinch and wheel zoom, chances, timer, hint, grid, win and lose sheets, exit and break animations; progress, best times and the win streak saved on the device; a dev page to open any puzzle by seed |
| Next                                              | Daily challenge (T4), then league, events, ads, iOS: see [docs/PLAN.md](docs/PLAN.md)                                                                                                                                                                                                                                                                   |
| CI                                                | Lint, format, typecheck, unit tests, build with a size budget; Playwright end to end; calibration suites                                                                                                                                                                                                                                                |

## Quick start

You need Node 20.19+ or 22.13+ (22 LTS is recommended; `nvm use` reads [`.nvmrc`](.nvmrc)) and
pnpm, which Corepack provides at the version pinned in `package.json`.

```sh
corepack enable
pnpm install
pnpm dev   # the game at http://localhost:5173, any puzzle at http://localhost:5173/dev.html
```

| Command                                        | What it does                                                                                               |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `pnpm dev` · `pnpm preview`                    | Runs the app with Vite (the puzzle picker is at `/dev.html`); serves the production build                  |
| `pnpm build`                                   | Builds the engine into `packages/engine/dist` and the app into `apps/game/dist`; fails over 300 kB gzipped |
| `pnpm test:e2e`                                | Playwright against a fresh production build, as a touch phone and on a desktop                             |
| `pnpm test`                                    | Unit and property tests for every package (a few seconds)                                                  |
| `pnpm test:calibration`                        | The long suites: difficulty bands over 400 levels, league promotion rates over 120 simulated days          |
| `pnpm lint` · `pnpm format` · `pnpm typecheck` | Type-aware ESLint, Prettier, and `tsc` for every project                                                   |

A Husky pre-commit hook runs `lint`, `format:check`, `typecheck` and `test`.

## A level, in text

`renderAscii` draws any puzzle as text; this is level 11, the first medium board:

```
│↑↑←┐←┐┌──┐
└┘└┐└┐└┘←┐│
┌┐↑││└┐←┐└┐
│↓│└┘↑└─│┌┘
←─┌→↑│──→└┐
─→│↑│└┐─→↑│
┌──│↑┌┘↑┌┘│
│←──┘│↑││←┐
↓←─┌─→│││↑│
┌─┐│↑││└┐││
│┌┘│└┘←┐└─┘
←┘←┘←──└┐─→
←───│↑┌─┘─→
```

Each arrow is a path; the arrowhead is its head. The arrow at the top left pointing up can go
right away. The one two rows down pointing left is blocked by the path next to it until that
path has gone.
