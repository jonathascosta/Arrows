# Arrows: product document

This is the source of truth for what we are building. Code follows this document; when the
product changes, change this document first. [ARCHITECTURE.md](ARCHITECTURE.md) explains how
the code is put together.

## One line

A single-player iPhone puzzle game. The board is full of arrow-shaped paths. Tap an arrow whose
way out is free and it slides off the board. Clear the board. Every level, daily challenge and
event board is generated on the phone from a seed, so there are infinitely many and everyone
plays the same ones.

Reference: Amaze GO! (App Store). We match its core loop and improve on honesty and polish.

## Platform and stack

- iPhone first. iPad and Android later if it works.
- TypeScript everywhere. The engine is a pure package with no dependencies and no DOM, tested
  with Vitest. The app is a Vite web app wrapped with Capacitor for the App Store.
- Everything that is logic or UI runs and is tested in Claude Code Cloud on Linux. The iOS build
  runs on a macOS runner in GitHub Actions and ships through TestFlight.
- Assets: Claude Design produces the visual assets (icons, backgrounds, drawings for event
  boards, character avatars). Arrows and paths are drawn by code, so a theme is data.
- No backend in v1. See [Backend](#backend).

## Core rules

- The board is a grid. Every active cell belongs to exactly one arrow. An arrow is a path of
  one or more adjacent cells; its head is the last cell and points along the last segment (a
  one-cell arrow points wherever the generator decided).
- Tapping an arrow is a valid move when the straight ray from its head to the edge of the board
  is empty. The arrow then slides out: the head moves along the ray and the body follows the
  head's track. Its cells become empty.
- Tapping a blocked arrow costs one chance. The player has 3 chances per board, drawn as
  arrowheads (see [DESIGN.md](DESIGN.md)). At 0 chances the board is lost and can be retried. The blocked arrow bumps towards what blocks it, and both flash, so
  the player sees why.
- Tapping an empty cell or the space around the board does nothing and costs nothing.
- The board is won when every arrow is gone.
- A timer runs from the first tap that lands on an arrow, pauses while the app is in the
  background, and stops when the board is won or lost. Time and chances lost feed the score.
- Hint: highlights one free arrow (the one with the shortest way out), and brings it into view
  when zoomed in. The button reads "Hint shown" until that arrow is gone. Always behind a rewarded ad (the ad comes with T7 in [PLAN.md](PLAN.md)).
- Grid toggle: shows the cell grid under the paths, for players who want to read the board.
- Pinch zoom and pan on the board (wheel and drag on desktop). Hit testing is by cell at the
  current scale, not by distance to the stroke; big boards are unplayable otherwise. The board
  sits between the top bar and the tool bar. A double tap on empty space resets the zoom; taps on
  arrows always play, however fast they come.
- No undo. A free undo would make chances meaningless, and a paid one adds nothing.
- A lost board is retried as the same puzzle (same seed), with fresh chances and timer.

## Boards

- **Rectangle**: the board of every ordinary level and of the daily challenge. One colour.
- **Drawing**: the board of events and championships. A small pixel-art PNG (roughly 20 to 30
  pixels wide, up to 80 tall) with a reduced palette. Transparent pixels are inactive cells.
  Each path stays inside one colour, so the drawing is visible in the arrows. Drawings come from
  Claude Design and live in the repository as data.
- On a concave drawing the ray crosses inactive cells. The rule is `bounds`: inactive cells are
  empty space and the ray runs to the edge of the bounding rectangle, so a wing of a butterfly
  can be blocked by the body across the gap. The engine also supports `mask` (out as soon as the
  ray leaves the drawing), kept for a possible event variant.

## Content generation

Everything is generated on the device, deterministically, from a seed:

- Level N: seed `level:N`. Daily: seed `daily:YYYY-MM-DD`. Event board: seed from the event id
  and the drawing. Same seed, same puzzle, on every phone, forever. Nothing is downloaded or
  stored.
- Two phases: **partition** the active cells into paths by seeded random walks (within one
  colour), then **peel**: simulate the solution forward, choosing for each path which end is
  the head so that the ray is free at its turn. Peeling is monotone (removing an arrow only
  frees cells), so it never needs backtracking; when nothing can be peeled, one path is split
  at an extreme cell, which always unblocks it. The peel order is a solution.
- Every generated puzzle is verified by the solver before it is used. A property test keeps
  that true for thousands of seeds.
- Difficulty is measured, not assumed. The solver reports for each puzzle: number of arrows,
  cells, average path length, free arrows per step (absolute and as a ratio of the remaining
  arrows), ray length at removal, near misses (arrows blocked by exactly one cell), heads at the
  border. The generator produces several candidates per seed and keeps the one that lands in
  the target band of its tier. A calibration suite keeps the bands honest.

### Tiers and the level path

| Tier       | Board (start) | Grows to (around level 300) | What makes it harder                    |
| :--------- | :------------ | :-------------------------- | :-------------------------------------- |
| Easy       | 6 x 8         | 6 x 8                       | Levels 1 to 10 only                     |
| Medium     | 9 x 13        | 13 x 19                     | Size                                    |
| Hard       | 11 x 16       | 16 x 24                     | Fewer free arrows per step, longer rays |
| Super Hard | 14 x 20       | 20 x 30                     | Both, and long winding paths            |

Levels 1 to 10 are easy. From 11 on, every block of 10 levels has the pattern
medium, medium, hard, medium, medium, medium, hard, medium, medium, super hard (so level 300 is
super hard and 303 is hard, like the reference). Sizes grow slowly with the level number and
plateau around level 300. The level path is infinite.

## Modes

### Levels

An infinite path of numbered levels with the tier shown by colour. Progress and best times are
stored locally, on the device.

- The current level is the next one to play: one past the highest level won. Replaying an earlier
  level never moves it back.
- The best time of each level is kept.
- The win streak counts consecutive first-try wins on new levels. A level won for the first time,
  without losing a board on it first, adds one. A lost board sets the streak to zero, and winning
  that level later leaves it at zero, whether after a retry or after leaving and coming back.
  Leaving a board unfinished does not count either way.
- A replay (a level already won) only keeps its best time: winning or losing it leaves the
  streak alone, like daily and event boards.

The home screen (see [DESIGN.md](DESIGN.md), Home) opens the game: the Levels card with the
current level, its tier, a strip of the levels around it and Play; the streak; and a card for
each other mode.

### Daily challenge

One puzzle per calendar day, the same for everyone. A calendar per month: past days are
playable, future days locked, today shows progress. Each completed day earns a star; a month
with every star earns a trophy. The daily board is a larger medium or hard rectangle, bigger on
weekends.

### Daily league

A league table that resets every day at midnight in the player's local time (a day key is
`YYYY-MM-DD` in local time; we may move to a fixed time zone later). Promotion to the next league for the top 10 of 30,
relegation for the bottom 10 (none from Bronze). Leagues: Bronze, Silver, Gold, Platinum,
Diamond, Master, Legend. Points come from every board finished that day, weighted by tier, time
and chances lost, with a bonus for event boards.

Until there are enough real players, the other 29 entries are **characters of the game**, and
the game says so: they have character avatars, a generated name (Wonderful Butterfly, Smart Dog)
and a small "character" label, and the rules screen explains that you compete against the
game's characters until the league has players. Characters are simulated on the device: each has
a skill and a daily activity curve, so the table changes during the day without a server. Their
strength grows with the league, calibrated so that a player who finishes about 8 medium boards a
day climbs the low leagues in a day or two and needs around 20 boards a day to hold Legend. The
calibration suite enforces those bands. When a backend exists, real players join the same table
with a different label, and the promise made on the rules screen is kept.

### Events and championships

Time-limited sets of drawing boards (a butterfly, a surfboard) with their own progress and a
reward. A championship is an event with its own league table over the event's duration. v1 ships
the drawing boards and one event; the championship table reuses the league code.

## Monetization

- Interstitial ad between finishing a board and the score screen. Nowhere else.
- Hints always show a rewarded ad.
- Chances are lives only in v1. A currency (buy a continue, buy a hint without an ad) is v2.
- Remove-ads purchase is v2.

## Themes

v1 ships one theme, the one in [DESIGN.md](DESIGN.md), but the UI is themeable from the start: background, board, path stroke,
arrowhead, grid, colour palette for drawings and the UI chrome all come from one theme object.
Themes (trains, worms, cables, noodles) are v2 and are mostly data plus an exit animation.

## Backend

None in v1. Everything works offline. The league and the daily are deterministic, so no server
is needed for them to be the same for everyone.

v2 may add a small API for real leaderboards and real players in leagues, within a budget of
50 euros a month (Azure consumption tier or similar). The app talks to leagues through one
interface so the simulated and the real providers are interchangeable.

## Not in v1

Themes, a currency, remove-ads purchase, backend, iPad layout, Android, Game Center,
localization beyond English (strings are externalized from day one so Portuguese is cheap).

## Milestones

1. Engine: generator, solver, difficulty, tiers, seeds, drawings, league simulation. Tests and
   calibration in CI.
2. Playable web prototype: board rendering, tap, zoom and pan, lives, timer, win and lose.
3. Levels path and daily challenge with local persistence.
4. Daily league with characters.
5. Events with drawing boards, score screen with the ad slots, hint with rewarded ad.
6. Capacitor iOS project, macOS build in CI, TestFlight.
7. Polish: animations, sound, haptics, one theme designed in Claude Design.

## Decisions log

- No undo (2026-10-02).
- A lost board is retried as the same puzzle (2026-10-02).
- The daily league runs on the player's local day, for now (2026-10-02).
- Ray rule on drawings is `bounds` (2026-10-02).
- Lives are chances, drawn as arrowheads, not drops; the visual direction is the one in
  [DESIGN.md](DESIGN.md) (2026-10-03).
- Replays of a level already won do not touch the win streak; only new levels count (session
  decision in T3, open to the owner) (2026-10-03).

## Open questions

- Should replays of a level already won count towards the win streak? The session decided no in
  T3, so the streak cannot be pumped by replaying an easy level (see Levels and the decisions
  log); the owner may reverse it.
