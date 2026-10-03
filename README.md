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

| Area                                              | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/engine`](packages/engine/src/index.ts) | Done for v1: seeded RNG, boards and drawings, generator (partition and peel), solver and difficulty metrics, tiers, level and daily seeds, game state, daily league simulation, tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`apps/game`](apps/game/src/main.ts)              | Playable in the browser in the designed Paper theme (T2, T2b, T3, T4, T5, T6, T7) and as an iPhone app with Capacitor (T8), in English and Brazilian Portuguese (T9): home screen with the level path, streak and mode cards; the daily challenge calendar with stars and trophies; the daily league against the game's characters, with promotion, relegation and the day's summary; the Autumn event's drawing boards with progress and a badge; SVG board, tap by cell, pinch and wheel zoom, chances, timer, hint, grid, the score screen after a win and the lose sheet, exit and break animations; the ad slots (an interstitial before the score, a rewarded ad before each hint), empty on the web, with test ads from the dev page; progress, best times, the win streak and the days won saved on the device; a dev page to open any puzzle by seed; sounds for every tap outcome and a promotion, Settings to turn them off, text that follows the phone's text size, Lighthouse accessibility above 90 on every screen; on iPhone, haptics, AdMob ads (test units until the owner's) and records kept in the app's preferences |
| Next                                              | Store readiness (T10): see [docs/PLAN.md](docs/PLAN.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CI                                                | Lint, format, typecheck, unit tests, build with a size budget; Playwright end to end and Lighthouse accessibility; calibration suites; the iOS build on macOS; TestFlight by hand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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
| `pnpm test:a11y`                               | Lighthouse's accessibility audit of every screen of a fresh production build; fails at 90 or below         |
| `pnpm test`                                    | Unit and property tests for every package (a few seconds)                                                  |
| `pnpm test:calibration`                        | The long suites: difficulty bands over 400 levels, league promotion rates over 120 simulated days          |
| `pnpm lint` · `pnpm format` · `pnpm typecheck` | Type-aware ESLint, Prettier, and `tsc` for every project                                                   |
| `pnpm drawings` · `pnpm drawings:check`        | Converts the PNG art in `art/drawings` to the engine's drawings; the check fails when they differ          |
| `pnpm ios:sync`                                | Builds the app and copies it into the Xcode project; then open `apps/game/ios/App/App.xcodeproj` on a Mac  |

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
