# Execution plan

The remaining work, cut into tasks that one Claude Code Cloud session each can finish, verify and
hand back as a pull request. [PRODUCT.md](PRODUCT.md) says what we build, [ARCHITECTURE.md](ARCHITECTURE.md)
how the code is organised. This file says in which order and what "done" means.

## How a session runs

1. Start the session on `main` with the Opus model selected, and open with the prompt of one
   task below, for example: `Read docs/PLAN.md and execute task T2.`
2. The session reads `CLAUDE.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` and this file before
   touching code, then works on a branch named `claude/<task-id>-<short-name>`.
3. Done means: every acceptance criterion below is met, `pnpm lint`, `pnpm format:check`,
   `pnpm typecheck` and `pnpm test` pass locally, the pull request is open against `main`, CI is
   green, and the pull request description lists the criteria with how each was verified. The
   session updates `docs/ARCHITECTURE.md` when the structure changes and `docs/PRODUCT.md` when
   behaviour changes, and marks the task done in this file.
4. One task per session. If a task turns out to need something from a later task, the session
   says so in the pull request and stops at a clean boundary instead of widening the scope.
5. Design decisions that this plan and the product document do not cover go to the owner as a
   question in the pull request, with a recommendation. Everything else the session decides.

## Conventions the tasks share

- TypeScript everywhere; the engine stays pure (no DOM, no dependencies).
- The app is `apps/game`: Vite, vanilla TypeScript and DOM, no UI framework unless a task says
  otherwise. Styling in CSS with custom properties, which is what makes the theme a data object.
- Every screen reads colours, strokes, fonts and asset paths from one `Theme` object. No colour
  literal outside the theme file.
- Persistence, ads, leaderboards and platform services sit behind interfaces with an in-memory
  or web implementation, so the app runs and is testable in a browser and in Node.
- Tests: Vitest for logic (jsdom where the DOM is needed), Playwright for end-to-end flows using
  the Chromium that the cloud session already has (`executablePath: '/opt/pw-browsers/chromium'`,
  never `playwright install`).
- English in code and documents; player-facing strings in one `strings.ts` keyed for later
  localisation.

## Tasks

### T1. Merge the engine (owner)

Merge `claude/engine-v1` into `main`. Every later task starts from `main`.

### T2. Playable board in the browser

The first thing anyone can play.

- `apps/game` scaffold: Vite, TypeScript, Vitest project, Playwright config, `pnpm dev`,
  `pnpm build`, `pnpm preview`, the app added to the root CI job.
- `Theme` object and `theme/default.ts` with the palette of the reference screenshots (pale
  green background, dark green strokes, blue drops) as placeholder until the designed theme
  arrives.
- Board renderer in SVG: one `<path>` per arrow with round joins and caps, an arrowhead at the
  head, strokes inset in the cell so parallel paths never touch, an optional cell grid layer.
- Input: tap resolved to a cell at the current zoom, then `arrowAt` and `tap` from the engine.
  Pinch zoom and two-finger pan on touch, wheel zoom and drag on desktop, board clamped to the
  viewport, double tap resets.
- HUD: drops (three, lost on a blocked tap), timer that starts on the first tap, hint button
  (calls `hint` directly for now; the ad gate comes in T7), grid toggle.
- Flow: win and lose overlays; lose offers retry of the same puzzle; win offers next level.
- Exit animation: the arrow slides along its own body and then the ray, 250 to 400 ms; a
  blocked arrow shakes. Reduced-motion preference respected.
- Dev page `dev.html` with a level number input, a daily date input and a drawing picker, so any
  puzzle can be opened by seed.

Acceptance: level 1 playable to a win in Chromium through a Playwright test that follows the
engine's hints; a blocked tap costs a drop; three blocked taps show the lose overlay and retry
reloads the same arrows; level 300 renders and stays responsive; `pnpm build` output under
300 kB gzipped.

### T3. Persistence and the level path

- `Storage` interface with a `localStorage` implementation and an in-memory one for tests;
  schema versioned from day one.
- Progress: current level, best time per level, win streak (consecutive first-try wins), drops
  are per board and not stored.
- Level path screen: horizontal strip of upcoming levels with the tier colour, current level
  button with tier label and the streak badge, like the reference home screen.
- Home screen shell with the three cards (league, daily, events) as placeholders that navigate.

Acceptance: finishing a level advances the path and survives a reload; streak counts only
first-try wins; Playwright covers win, lose, reload.

### T4. Daily challenge

- Day key from the device's local date (`YYYY-MM-DD`), as the product document decides.
- Calendar screen for a month: past days playable, today with a progress ring, future days
  locked, month navigation, stars for finished days, trophy when every day of the month is done.
- Playing a day uses `generateDaily(dateKey)`; results stored per day key.

Acceptance: the calendar reflects stored results after reload; a past day opens the same puzzle
as the day it was generated; future days cannot be opened; unit tests for the day key and the
month model.

### T5. Daily league

- `LeagueProvider` interface; `SimulatedLeagueProvider` built on the engine's `generateSeason`,
  `standings`, `resolveDay`, keyed by local day; the player's points from `scoreBoard` for every
  board finished that day.
- League screen: table of 30 with the player highlighted, characters marked with the character
  label and avatar, promotion and relegation zones, countdown to midnight, the league badge.
- Day rollover: on first open of a new day, resolve the previous day, move leagues, show a
  summary ("while you were away" with the final rank and the outcome).
- Rules screen text that says the opponents are characters of the game until the league has
  players.

Acceptance: unit tests for rollover across one and several missed days; Playwright for the
table and the summary; promotion visible after a simulated winning day.

### T6. Drawings and events

- `tools/png-to-drawing.ts`: reads a PNG with a transparent background and a small palette,
  writes a `Drawing` (rows and legend) into `packages/engine/src/drawings/`, with a check mode
  for CI. Node only; uses `pngjs` as a dev dependency of the tools, never of the engine.
- A first event with two drawings and the `bounds` ray rule, an event card on the home screen
  with its end date, per-board progress and a reward (a badge for now).
- Renderer colours each arrow by its palette index through the theme.

Acceptance: a PNG in the repository round-trips to a drawing identical to the checked-in one;
the event boards are playable; colours match the drawing.

### T7. Score screen and ad slots

- `AdProvider` interface: `showInterstitial()`, `showRewarded()` returning whether the reward was
  earned; a web no-op implementation that resolves immediately, and a debug implementation that
  shows a fake ad overlay for testing the flow.
- Score screen after every finished board: time, drops left, points, streak, buttons for next
  and home. The interstitial runs between the win and this screen, nowhere else.
- Hint always goes through `showRewarded`; no reward, no hint.

Acceptance: Playwright shows the fake interstitial exactly once per finished board and the fake
rewarded ad on every hint; the no-op provider keeps the web build ad-free.

### T8. iOS with Capacitor

- Capacitor project for iOS in `apps/game`, app id and name agreed with the owner, safe-area
  handling, status bar, haptics on tap outcomes, `Preferences` plugin behind the `Storage`
  interface.
- GitHub Actions job on a macOS runner that builds the iOS app (no signing) on every push to
  `main`, and a manual job that signs and uploads to TestFlight with fastlane from repository
  secrets (the owner adds the secrets; the job documents which ones).
- AdMob provider behind `AdProvider`, with test ad unit ids until the owner provides real ones.

Acceptance: the macOS build job is green; a TestFlight build installs and plays on an iPhone;
the owner confirms the ads show in the test build.

### T9. Polish with the designed theme

- Replace the placeholder theme with the assets from Claude Design: background, icons, drops,
  arrowhead style, character avatars, league badges, event art.
- Sound effects and haptics for tap, blocked, win, lose, promotion.
- Accessibility: VoiceOver labels for the HUD, reduced motion, dynamic type for text screens.
- Localisation: English and Portuguese from `strings.ts`.

Acceptance: a reviewer compares every screen against the reference app and the design files;
Lighthouse accessibility above 90 on every screen of the web build.

### T10. Store readiness

App icon, launch screen, App Store screenshots from the web build at iPhone sizes, privacy
manifest, ads consent (App Tracking Transparency prompt), and the store listing text in the
repository.

## After v1

Themes as data packs, drop currency, remove-ads purchase, real leaderboards through a small
API within the budget in the product document, Android, iPad.

## Status

| Task | State | Pull request                                         |
| :--- | :---- | :--------------------------------------------------- |
| T1   | done  | [#1](https://github.com/jonathascosta/Arrows/pull/1) |
| T2   | done  | [#2](https://github.com/jonathascosta/Arrows/pull/2) |
| T3   | open  |                                                      |
| T4   | open  |                                                      |
| T5   | open  |                                                      |
| T6   | open  |                                                      |
| T7   | open  |                                                      |
| T8   | open  |                                                      |
| T9   | open  |                                                      |
| T10  | open  |                                                      |
