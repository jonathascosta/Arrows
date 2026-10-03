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
   green, the pull request description lists the criteria with how each was verified, and the
   isolated reviewer (step 4) has approved it. The session updates `docs/ARCHITECTURE.md` when
   the structure changes and `docs/PRODUCT.md` when behaviour changes, and marks the task done in
   this file.
4. Review loop, on every pull request: once the pull request is open, the session starts a
   separate review agent in its own worktree, with no context from the session beyond the
   pull request and the repository documents. The reviewer checks the diff against the task's
   acceptance criteria and the documents, runs the gates, and answers with a verdict (approved,
   or changes requested with findings). The session fixes every blocking finding, pushes, and
   asks the same reviewer to review again, until it approves. The session then posts one comment
   on the pull request recording the rounds and the approval, and merges the pull request itself
   once CI is green on its head.
5. After the merge, the session moves on to the next open task in this file on its own, from the
   updated `main`, and repeats the cycle. If a task turns out to need
   something from a later task, the session says so in the pull request and stops at a clean
   boundary instead of widening the scope.
6. Design decisions that this plan and the product document do not cover go to the owner as a
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

### T2b. Designed theme and chances

The play screen in the direction of [DESIGN.md](DESIGN.md), and chances instead of drops.

- Theme: the tokens of DESIGN.md in `theme/default.ts` (replacing the placeholder), Instrument
  Serif and Geist bundled as `woff2`, the arrowhead of the Board section (sharp corners, tip
  0.42, length 0.42, width 0.34).
- Chances replace drops everywhere: identifiers, theme tokens, strings, tests, data attributes.
  Chance icons in the header with the breaking animation; reduced motion changes state at once
  and holds the red.
- Play screen layout per DESIGN.md: round back button, title left in serif, tier in small caps,
  chances and timer on the right; bottom tool bar with Grid and Hint (with its `AD` badge; the ad
  itself comes in T7).
- Lose as the bottom sheet of DESIGN.md over the faded board; win keeps its content until T7 but
  takes the new type and colours.
- A unit test checks WCAG contrast of every text token on its background (4.5:1 for body text,
  3:1 for large titles and icons).

Acceptance: screenshots at 390 by 844 of level 1, level 300, the butterfly, a board with one
chance lost and a lost board, attached to the pull request next to the design; every earlier test
passes with the new names; the build stays under 300 kB gzipped with the fonts.

### T3. Persistence and the level path

- `Storage` interface with a `localStorage` implementation and an in-memory one for tests;
  schema versioned from day one.
- Progress: current level, best time per level, win streak (consecutive first-try wins); chances
  are per board and not stored.
- Home screen per the Home section of [DESIGN.md](DESIGN.md): the Levels card with its level
  strip and Play, the streak chip, and the Daily, League and Event cards (placeholders that
  navigate until T4, T5 and T6 fill them).

Acceptance: finishing a level advances the path and survives a reload; streak counts only
first-try wins; Playwright covers win, lose, reload.

### T4. Daily challenge

- Day key from the device's local date (`YYYY-MM-DD`), as the product document decides.
- Calendar screen per the Daily challenge section of [DESIGN.md](DESIGN.md): week from Monday,
  past days playable, today outlined, future days locked, month navigation, stars for finished
  days, the trophies row, and "Play today" with the day's board.
- Playing a day uses `generateDaily(dateKey)`; results stored per day key.

Acceptance: the calendar reflects stored results after reload; a past day opens the same puzzle
as the day it was generated; future days cannot be opened; unit tests for the day key and the
month model.

### T5. Daily league

- `LeagueProvider` interface; `SimulatedLeagueProvider` built on the engine's `generateSeason`,
  `standings`, `resolveDay`, keyed by local day; the player's points from `scoreBoard` for every
  board finished that day.
- League screen per the Daily league section of [DESIGN.md](DESIGN.md): table of 30 with the
  player highlighted, characters with initials avatars and the `character` tag, the labelled
  promotion and relegation dividers, the countdown to midnight and the rules paragraph.
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
- Score screen after every finished board, per the Win section of [DESIGN.md](DESIGN.md): time
  with the best time, chances lost, score, streak line, league points line, next and home. The interstitial runs between the win and this screen, nowhere else.
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

- Remaining assets from Claude Design: illustrated character avatars, league badges, event art,
  app icon; the open points of [DESIGN.md](DESIGN.md).
- Sound effects and haptics for tap, blocked, win, lose, promotion.
- Accessibility: VoiceOver labels for the HUD, reduced motion, dynamic type for text screens.
- Localisation: English and Portuguese from `strings.ts`, including the number words of
  `spellOut`, which are English-only for now.

Acceptance: a reviewer compares every screen against the reference app and the design files;
Lighthouse accessibility above 90 on every screen of the web build.

### T10. Store readiness

App icon, launch screen, App Store screenshots from the web build at iPhone sizes, privacy
manifest, ads consent (App Tracking Transparency prompt), credits with the licences of the
bundled fonts (Instrument Serif and Geist, SIL Open Font License), and the store listing text in
the repository. Move the first daily (`DAILY_FIRST_DAY`, 1 January 2026 until then) to the
launch month.

## After the first TestFlight build

The owner played build 201 on an iPhone (3 October 2026) and asked for these, one pull request
each.

### T11. Screens scroll in the app

The app turned the web view's scrolling off, so a screen taller than the phone (Credits, the
league, the calendar in large text, the puzzle picker) could not be scrolled. Acceptance: the web
view scrolls (`scrollEnabled`), a test keeps it on, and the board's screen still does not move.

### T12. No puzzle picker in the app

The owner's decision: the picker is a tool for testing, so it stays in the web build for
development and leaves the app. Acceptance: Settings has no link to it, the iOS bundle does not
ship it, and the documents say so.

### T13. The grid on the arrows' lines

The grid toggle drew the cells' edges, while arrows run through the cells' centres. Acceptance:
the grid's lines run through the centres, where the arrows and their rays run, so a player can
follow a ray to the arrow it would hit.

### T14. Harder Hard and Super Hard

Super Hard felt easy: four to six arrows free at every step, each removal freeing about one more,
often the one right behind it in the same direction, and arrows of four or five cells. The
owner's decision: Super Hard gets long winding arrows (about eight cells) and usually one to
three free arrows at a time, with fewer queues of arrows in the same direction; Hard gets part
of that; Easy and Medium stay as they are. Acceptance: the calibration suite measures it, and
the fingerprint test changes on purpose.

### T15. Events of 300 boards

The owner's decision: an event has 300 boards, played in order, its drawings in turn, the tiers
in the levels' cycle of ten (medium, medium, hard, … super hard). The home card shows how many
of the 300 are won with a progress bar, and the badge comes with the 300th.

### T16. The policy and support pages on jonathas.net

The privacy policy and a support page for the listing move to the owner's site, jonathas.net
(with `app-ads.txt` for AdMob once its account exists), instead of GitHub Pages. Acceptance:
the listing's URLs point there, and the Pages workflow is gone.

## After v1

Themes as data packs, a currency, remove-ads purchase, real leaderboards through a small
API within the budget in the product document, Android, iPad.

## Status

| Task | State | Pull request                                           |
| :--- | :---- | :----------------------------------------------------- |
| T1   | done  | [#1](https://github.com/jonathascosta/Arrows/pull/1)   |
| T2   | done  | [#2](https://github.com/jonathascosta/Arrows/pull/2)   |
| T2b  | done  | [#3](https://github.com/jonathascosta/Arrows/pull/3)   |
| T3   | done  | [#4](https://github.com/jonathascosta/Arrows/pull/4)   |
| T4   | done  | [#5](https://github.com/jonathascosta/Arrows/pull/5)   |
| T5   | done  | [#6](https://github.com/jonathascosta/Arrows/pull/6)   |
| T6   | done  | [#7](https://github.com/jonathascosta/Arrows/pull/7)   |
| T7   | done  | [#8](https://github.com/jonathascosta/Arrows/pull/8)   |
| T8   | owner | [#9](https://github.com/jonathascosta/Arrows/pull/9)   |
| T9   | owner | [#10](https://github.com/jonathascosta/Arrows/pull/10) |
| T10  | owner | [#11](https://github.com/jonathascosta/Arrows/pull/11) |
| T11  | done  | this pull request                                      |
| T12  | done  | this pull request                                      |
| T13  | open  |                                                        |
| T14  | open  |                                                        |
| T15  | open  |                                                        |
| T16  | open  |                                                        |

T8 is built and its macOS build job is green; its other two criteria, a TestFlight build on an
iPhone and the ads in it, wait on the owner's Apple Developer and AdMob accounts (the secrets
and steps are in [ARCHITECTURE.md](ARCHITECTURE.md), iOS).

T9 is built: Portuguese, the sounds and the promotion cue, Settings, the text size, the emphasis
strokes, text screens that fit a 320 px phone at every text size, and Lighthouse
accessibility of 93 or more on every screen in both languages (`pnpm test:a11y`). The
assets still to come from Claude Design (character avatars, league badges, event art, the app
icon) wait on the owner; the screens keep the initials, plain badges and the board thumbnail
until then.

T10 is built: the consent message and the tracking prompt before any ad, Privacy choices in
Settings, the privacy manifest, the privacy policy (in the app and for GitHub Pages), Credits
with the fonts' and libraries' licences, the store listing in English and Portuguese, the
screenshots (`pnpm store:screenshots`), ads reloaded before they expire, and the first daily on
1 October 2026. What only the owner can do is in [STORE.md](STORE.md): App Store Connect, the
AdMob messages and units, GitHub Pages, Google's SKAdNetwork list, the App Privacy and age
rating answers, and the review. The app icon still waits on Claude Design; the launch screen is
the plain paper colour.
