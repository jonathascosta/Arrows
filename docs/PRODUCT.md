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

### The iOS app

- Named Arrows, with the app id `com.jonathascosta.arrows`; the id is fixed for good with the
  first upload to App Store Connect.
- iPhone only, in portrait. The page runs edge to edge on the paper colour and keeps its
  controls clear of the notch and the home indicator; the status bar shows dark text.
- Haptics on every tap that does something: a light tick when an arrow leaves, a warning when a
  blocked arrow costs a chance, success when the board is won and an error when it is lost.
  Taps on empty space are silent.
- The player's records stay on the phone (in the app's preferences, which iOS keeps), not in the
  web view's storage, which iOS may clear when space runs short.
- Ads come from AdMob: the interstitial and the rewarded ad of [Monetization](#monetization).
  Each is loaded ahead so it shows at once; one that is not ready within a few seconds is gone
  without (no interstitial, and no hint). While a hint's ad loads, the board waits and the Hint
  button reads "Loading ad…". Until the owner's AdMob units are set, the build shows Google's
  test ads.
- Before any ad is requested, the app asks for the player's choices about ads: Google's consent
  message where the law requires one (the EEA, the UK, Switzerland, some US states), then
  Apple's tracking prompt ("Your data will be used to show you ads that suit you better. The
  game is the same either way."). The game does not wait for either; ads load once they are
  answered, and none load if the choices allow none. An ad loaded more than 55 minutes earlier
  is loaded again before it shows, since ads expire after an hour.
- The privacy policy is in the app (Settings) and at the address the store listing gives; the
  app's privacy manifest declares what the app itself does (nothing is collected or tracked by
  the game's own code; Google's SDKs declare theirs).
- The app icon is the favicon's arrow on paper until Claude Design delivers one; the launch
  screen is plain paper.

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
  when zoomed in. The button reads "Hint shown" until that arrow is gone. Every hint is behind a
  rewarded ad: watched to the end, the hint shows; closed early, or when no ad can be shown,
  there is no hint. While a hint is on the board, pressing Hint again brings that arrow back into
  view without another ad, and the button shows no ad badge. The timer stops while the ad plays.
- Grid toggle: shows the cell grid under the paths, for players who want to read the board.
- Pinch zoom and pan on the board (wheel and drag on desktop). Hit testing is by cell at the
  current scale, not by distance to the stroke; big boards are unplayable otherwise. The board
  sits between the top bar and the tool bar. A double tap on empty space resets the zoom; taps on
  arrows always play, however fast they come.
- No undo. A free undo would make chances meaningless, and a paid one adds nothing.
- A lost board is retried as the same puzzle (same seed), with fresh chances and timer.
- A won board ends on the score screen, after the interstitial ad: the time (with the best time
  on a replay), the chances lost, the board's score (the points the league gives it, see Daily
  league), what the win did (the streak, a daily's star, an event's board or badge) and the
  league points it earned. Then the next level or event board, or the same board again, and the
  way home (a daily's leads to the calendar).

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

- Level N: seed `level:N`. Daily: seed `daily:YYYY-MM-DD`. Event board: seed
  `board:event:<id>:<n>`, from the event id and the board's number. Same seed, same puzzle, on
  every phone, forever. Nothing is downloaded or stored.
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

- The day is the device's local date (`YYYY-MM-DD`), like the league's.
- The calendar starts on 1 October 2026, the first daily: the first day of the earliest month
  the game can launch in, so today's daily is never locked. Earlier days and months do not
  exist.
- A day earns its star when its board is won, on that day or any day after. A lost board earns
  nothing and is not stored. Days can be replayed; a replay keeps the best time.
- A month's trophy needs every day of the month. The trophies row shows the current month once
  every day of it is won (on its last day), and each earlier month with at least one star: a
  trophy when complete, its count ("29 of 30") otherwise.
- Future days, and days before the first daily, cannot be opened, not even by a link: the
  calendar opens instead.
- Daily boards do not touch the level path or the win streak.

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

- Points: every board won counts for the day it is won on (levels, dailies and event boards), by
  tier and size, time against par (a second per cell) and chances lost, with the bonus for event
  boards. Each board counts once a day: winning the same board again that day adds nothing.
- The player joins a day's table by winning a board that day. Until then the table lists them
  last, without a rank and without a move; a day without a board won leaves the league as it is.
- The first time the game opens on a new day, the last day played is settled with its final table:
  the top 10 move up (not from Legend), the bottom 10 move down (not from Bronze). A summary shows
  the final rank and the move, once. Days missed in between change nothing.
- The score screen says what a board earned ("+38 points in Gold league · now 8th"), or that it
  already counted today.
- Every new player starts in Bronze.

### Events and championships

Time-limited sets of drawing boards (a butterfly, a surfboard) with their own progress and a
reward. A championship is an event with its own league table over the event's duration. v1 ships
the drawing boards and one event; the championship table reuses the league code.

- An event runs from a first to a last day, in the player's local time, like the daily.
- Its boards are played in order: the next board opens when the one before is won. Every board
  has its own seed (`board:event:<id>:<n>`), so everyone plays the same boards.
- Progress is kept per board. Winning every board earns the event's badge.
- Boards count only while the event runs. Before it starts and after its last day the boards
  cannot be opened; the home screen shows how far the player got and the badge, if earned. A
  board opened on the last day and won after midnight counts for neither the event nor the
  event bonus: the league scores it like any other board.
- Event boards earn league points with the event bonus.
- The first event is the Autumn event (1 October to 30 November 2026): a maple leaf and an acorn,
  each at Medium, Hard and Super Hard, six boards in all.
- Drawings are pixel art, one pixel per cell, drawn in the drawing palette (DESIGN.md) and
  converted to boards by a tool; the art lives in the repository as PNG.

## Languages

- English and Portuguese (Brazilian Portuguese). The game speaks the device's language when it is
  one of the two, English otherwise; there is no setting.
- Everything the player reads is translated, dates, ordinals ("8º"), numbers ("12.345") and the
  chances in words included, except the brand (Arrows), the characters' names in the league,
  which are names ("Wonderful Butterfly"), the "AD" mark on the Hint button, which the word
  "Anúncio" would not fit (VoiceOver says "mostra um anúncio"), and the puzzle picker, a tool for
  testing that Settings links to.
- The privacy policy is a page written in both languages, the player's first. The licences in
  Credits stay as their authors wrote them, in English.

## Sound, haptics and settings

- Short sounds for the moments the haptics mark: an arrow leaving, a blocked tap, a board won, a
  board lost, and a promotion in the league, which also has its haptic. The sounds are made by
  the game (no recordings), quiet, and follow the phone's silent switch in the app.
- The home screen's menu opens Settings: Sound and Haptics switches (Haptics only in the app),
  both on at first, then Privacy choices (in the app, where the law asks for a way back to the
  choices about ads), the privacy policy, Credits and the puzzle picker. The choices stay on the
  device.
- Credits name the fonts and the software the game is made with, each with its licence in full
  (the fonts' licence asks for it), and say where the ads come from.

## Accessibility

- Every control has a name for VoiceOver, and what changes on the board is announced (a blocked
  tap, a hint, the arrows left).
- Reduced motion turns the animations off: arrows leave at once, no pulse, no slide-in.
- The text screens (home, calendar, league, the sheets, the score) follow the phone's text size,
  up to one and a half times, and still fit a 320-pixel-wide phone in both languages; the
  board's screen keeps its size, so the board keeps its room, while its sheets and the score
  follow the text size like the other screens.
- Lighthouse's accessibility score is above 90 on every screen of the web build.

## Monetization

- Interstitial ad between winning a board and its score screen, once per board won. Nowhere
  else: a lost board shows no ad, and its sheet offers Retry at once.
- Hints always show a rewarded ad; no reward, no hint. An ad that fails to show earns no reward.
- Ads in the iOS app follow the player's choices about them (see The iOS app): consent where the
  law requires it, Apple's tracking prompt, and Privacy choices in Settings.
- The web build shows no ads: there is no interstitial, and the rewarded ad grants its reward at
  once. The puzzle picker can turn on test ads, which show a card in place of an ad so the flow
  can be tried; the iOS build (T8) plugs in the ad network.
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

Themes, a currency, remove-ads purchase, backend, iPad layout, Android, Game Center, languages
beyond English and Portuguese.

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
- Daily challenge (session decisions in T4, open to the owner) (2026-10-03): the calendar started
  on 1 January 2026 until the launch month was known (T10 moved it); a day won late still earns
  its star; a daily's sheets lead back to the calendar instead of home.
- Daily league (session decisions in T5, open to the owner) (2026-10-03): each board earns points
  once a day, so replaying one board cannot win a league; a day without a board won does not
  relegate, so time away costs nothing; several missed days settle only the last day played.
- Events (session decisions in T6, open to the owner) (2026-10-03): the Autumn event runs from 1
  October to 30 November 2026; after its last day its boards close, so a player who did not
  finish cannot finish later; a finished event's home card opens nothing; the maple leaf and the
  acorn are placeholder art drawn in the session (17 and 14 pixels wide, narrower than the
  drawings described in Boards), to be replaced by Claude Design's before players see them
  (replacing a drawing changes its boards).
- Ads and the score screen (session decisions in T7, open to the owner) (2026-10-03): only a won
  board has a score screen, and so an interstitial; a lost board keeps its sheet, so a retry is
  never behind an ad; a hint already on the board can be shown again without another ad; the
  timer stops while a rewarded ad plays, so the ad never costs time; an ad that fails to show
  (no ad to fill the slot) earns no reward, so no hint (many games grant it; T8 may revisit this
  with the real network); a board won again the same day shows its score with "Already counted in
  today's league." instead of points.
- The iOS app (session decisions in T8, open to the owner) (2026-10-03): the name Arrows and the
  app id `com.jonathascosta.arrows` (confirm before the first TestFlight upload, which fixes
  the id); iPhone only, portrait; the haptic cues above; an ad not loaded within four seconds is
  skipped, so the board never waits more than four seconds on the network; with the real network, no ad still means no
  hint, as T7 decided; a placeholder icon.
- Languages, sound and settings (session decisions in T9, open to the owner) (2026-10-03):
  Portuguese is Brazil's (the bigger market), from the device's language with no setting; the
  characters' names stay in English, since they are names; sounds are synthesised by the game
  until a designer makes real ones; the home menu becomes Settings (Sound, Haptics, the puzzle
  picker); text screens follow the phone's text size up to 1.5 times.
- Store readiness (session decisions in T10, open to the owner) (2026-10-03): the first daily is
  1 October 2026, the earliest possible launch month; the store listing is in English and
  Brazilian Portuguese, named Arrows (if the name is taken on the App Store, the owner picks
  another) under Games, Puzzle and Board; the privacy policy is published on the repository's
  GitHub Pages and support goes to the repository's issues, until the owner has a site; the
  consent order is Google's message, then Apple's prompt; the screenshots are the web build's
  screens without captions; Google's list of SKAdNetwork ids for its partners is the owner's to
  paste in (it could not be fetched from the session); the copyright holder is Jonathas Costa.

## Open questions

- Each board earns league points once a day, but every past daily and every level already won
  can still be replayed for points each day. Should replays earn less, or nothing? (T5 session
  note.)
- Should replays of a level already won count towards the win streak? The session decided no in
  T3, so the streak cannot be pumped by replaying an easy level (see Levels and the decisions
  log); the owner may reverse it.
