# Arrows

A single-player puzzle game for iPhone. The board is full of arrow-shaped paths. Tap an arrow
whose way out is free and it slides off the board. Clear the board. Every level, daily challenge
and event board is generated on the phone from a seed, so there are infinitely many and everyone
plays the same ones.

What we are building, and why, is in [docs/PRODUCT.md](docs/PRODUCT.md). How the code is put
together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status

| Area                                              | State                                                                                                                                                                                 |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/engine`](packages/engine/src/index.ts) | Done for v1: seeded RNG, boards and drawings, generator (partition and peel), solver and difficulty metrics, tiers, level and daily seeds, game state, daily league simulation, tests |
| `apps/game`                                       | Next: the playable web app (board rendering, zoom and pan, lives, timer), then levels, daily, league, events                                                                          |
| iOS                                               | Later: Capacitor project, macOS build in CI, TestFlight                                                                                                                               |
| CI                                                | Lint, format, typecheck, unit tests, build on every push; calibration suites in their own job                                                                                         |

## Quick start

You need Node 20.19+ or 22.13+ (22 LTS is recommended; `nvm use` reads [`.nvmrc`](.nvmrc)) and
pnpm, which Corepack provides at the version pinned in `package.json`.

```sh
corepack enable
pnpm install
pnpm test
```

| Command                                        | What it does                                                                                      |
| :--------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `pnpm test`                                    | Unit and property tests for every package (a few seconds)                                         |
| `pnpm test:calibration`                        | The long suites: difficulty bands over 400 levels, league promotion rates over 120 simulated days |
| `pnpm lint` · `pnpm format` · `pnpm typecheck` | Type-aware ESLint, Prettier, and `tsc` for every project                                          |
| `pnpm build`                                   | Builds the engine into `packages/engine/dist`                                                     |

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
