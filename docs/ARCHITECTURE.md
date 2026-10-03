# Architecture

How the repository is put together and why. [PRODUCT.md](PRODUCT.md) says what we are building.

## Goals and constraints

- **Deterministic content.** Level N and the daily of a date are the same puzzle on every phone,
  forever. Every random draw goes through a seeded `Rng`; `Math.random` is banned by ESLint.
- **Measured difficulty.** No puzzle ships unmeasured: the solver rates every generated puzzle,
  and calibration suites keep the tiers inside the bands the product document promises.
- **Pure engine.** `packages/engine` has zero dependencies and no DOM, so it runs in the app, in
  Node for tests and tools, and on a server if one ever exists. The UI never decides outcomes.
- **Testable in the cloud.** Everything but the iOS build runs on Linux. Claude Code Cloud can
  change and verify any part of the logic or the web UI.

## Packages

| Package           | Role                                                                       | May import     |
| :---------------- | :------------------------------------------------------------------------- | :------------- |
| `packages/engine` | Boards, generator, solver, difficulty, tiers, game state, league sim       | Nothing        |
| `apps/game`       | The Vite app: rendering, input, screens, persistence, ads; the iOS wrapper | engine         |
| `tools`           | Build-time tools: drawings from PNG art (`pngjs`), never shipped           | engine (types) |

Workspace packages export their TypeScript sources (`"exports": "./src/index.ts"`), so Vite,
Vitest and `tsc` consume the source directly. The engine also has a real build (`tsc -p
tsconfig.build.json` into `dist/`) for anything that consumes plain JavaScript.

### Drawings from PNG art

Drawings are pixel art in `art/drawings/`: one PNG per drawing, one pixel per cell, transparent
where there is no cell, every other pixel exactly one colour of the drawing palette.
`art/drawings/drawings.json` names each colour (`#a83e34` is `red`, as the theme names them) and,
per drawing, its id, name, file and legend (character to colour name, in palette order).
`pnpm drawings` runs `tools/png-to-drawing.ts`, which reads every PNG and writes
`packages/engine/src/drawings/art.ts`, formatted with Prettier; the engine's `DRAWINGS` is that
module. A pixel off the palette, half transparent, of a colour the legend does not name, or a
legend colour never drawn fails with the file and the pixel. `pnpm drawings:check`, in CI, fails
when `art.ts` is not what the art makes, so nobody edits the generated module by hand. The engine
gains no dependency: `pngjs` belongs to the tools.

## Engine

### Module map

| Module       | Contents                                                                                                                     |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `rng/`       | `createRng(seed)`: xoshiro128\*\* seeded from a string hash, with `fork(label)` for independent streams                      |
| `board/`     | `Cell`, `Direction`, `Mask` (active cells and colours), `Path`, `Arrow`, `Puzzle`; mask constructors                         |
| `generator/` | `partition` (phase one), `peel` (phase two), `generatePuzzle`, `generateInBand`                                              |
| `solver/`    | `Occupancy` and the allocation-free ray scan; `analyze` (reference solution and metrics)                                     |
| `game/`      | `GameState`: `createGame`, `tap`, `hint`, `freeArrows`, `arrowAt`. Immutable, UI-agnostic                                    |
| `levels/`    | Tiers and their knobs, `tierForLevel`, `boardSizeForLevel`, `generateLevel`, `generateDaily`, boards                         |
| `drawings/`  | `Drawing` (rows and legend), `drawingMask`, `findDrawing`; `art.ts`, generated from art/drawings (see Drawings from PNG art) |
| `league/`    | Character names, `scoreBoard`, seasons, character score curves, standings, promotion rules                                   |
| `debug/`     | `renderAscii`, for tests, fixtures and bug reports                                                                           |

### The rule

An arrow is a path of adjacent cells; its head is the last cell and points along the last
segment. The arrow is free when the ray from its head to the edge is empty, counting every
occupied cell, its own body included. `rayStatus` scans that ray on an `Int32Array` of cell
owners and reports its length and its blockers without allocating.

Two ray modes exist for drawings: `bounds` runs the ray to the bounding rectangle (inactive cells
are empty space), `mask` stops it at the first inactive cell.

### Generation

```mermaid
flowchart LR
  seed["seed\nlevel:N · daily:date · board:id"] --> rng["Rng\nfork('partition') · fork('peel')"]
  rng --> partition["partition\nrandom walks within a colour"]
  partition --> peel["peel\nforward simulation picks heads"]
  peel --> analyze["analyze\nreference solution + metrics"]
  analyze --> band{"in the tier band?"}
  band -- "no, next sub-seed" --> rng
  band -- yes --> puzzle["Puzzle"]
```

1. **Partition.** Active cells are visited in random order; from each unowned cell a walk claims
   free same-colour neighbours up to a sampled target length (geometric from the mean, capped).
   The walk prefers the neighbour with the fewest free neighbours (Warnsdorff's rule), which
   strands fewer single cells; a final pass attaches remaining singles to an adjacent path end.
2. **Peel.** The solution is simulated forward on the full board. At each step every path with
   an end whose ray is free is a candidate; one is chosen (uniformly, or with `bias` towards the
   longest ray, which puts heads deeper inside), that end becomes the head, and the path leaves.
   Removal only frees cells, so the greedy process never backtracks. If no end is free, the
   topmost occupied cell is cut out of its path as a single cell pointing up, which is free by
   construction; the count of such repairs is reported. The peel order is a valid solution, and
   ids are then assigned by head position so the ids do not leak the order.
3. **Verify and rate.** `analyze` plays the puzzle with a fixed policy (shortest free ray first)
   and measures: arrows, cells, path lengths, free arrows per step, free over remaining
   (`avgFreeRatio`, the main signal), ray length at removal, near misses, heads on the border.
   A puzzle that does not solve is a bug and throws.
4. **Band selection.** `generateInBand` tries sub-seeds `seed#0`, `seed#1`, ... and keeps a
   candidate inside the tier's band (the easiest, the hardest or the first, per tier), or the
   nearest. Deterministic: the same seed always picks the same candidate.

What the measurements say: the number of free arrows at any moment is about 3 to 6 on any
board, so the playable share of the board falls with the number of arrows. Board size is the
main difficulty knob; the peel bias lengthens rays; picking the hardest of several candidates
trims easy outliers. The bands overlap on purpose, as in the reference game, where the label is
relative to the position on the level path.

### Content pins

`levels.test.ts` pins the fingerprint of a few levels. Any change to the RNG, the partition,
the peel, the tiers or the band selection changes every player's level N; the pin makes that a
deliberate decision with a changelog entry, never an accident.

### League simulation

`generateSeason(league, dayKey)` derives 29 characters from the seed `league:<index>:<day>`: a
name, an avatar index, a daily total drawn log-normally around the league's median, and one to
four sessions at typical times of day. `characterScoreAt(character, secondsOfDay)` sums the
sessions' smooth ramps, so the table moves during the day with no server and no stored state.
`standings` ranks the player among them; `resolveDay` applies the top-10 and bottom-10 rules.
The calibration suite simulates 120 days per league and keeps promotion rates in the bands the
product document sets.

## App

`apps/game` is a Vite app in vanilla TypeScript and DOM, with no UI framework. `index.html` plays
the puzzle named by the URL (`?level=N`, `?daily=YYYY-MM-DD`, `?event=id&board=N`,
`?drawing=id&tier=t`), shows the daily
calendar (`?calendar`, or `?calendar=YYYY-MM` for a month), the daily league (`?league`), or the
home screen when the URL names nothing (or something invalid); `dev.html` opens any puzzle by seed
and shows what the solver measured, and the home screen's menu button leads to it. Its Preview shows
any day, but its Play link follows the game's rules: a day ahead of today, or before the first
daily, opens the calendar.

### Module map

| Module                           | Contents                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/`                         | `Theme` (colours, tier colours, drawing palette, avatar colours, shadows, board geometry, chance direction, icons, fonts, motion) and `applyTheme`, which writes CSS custom properties; `default.ts` is the Paper theme of [DESIGN.md](DESIGN.md); `contrast.test.ts` holds every pairing the screens use to WCAG AA, with the drawing palette's known gaps listed             |
| `board/geometry.ts`              | Pure: arrow body and head shapes, exit track, grid lines, board bounds, in cell units                                                                                                                                                                                                                                                                                          |
| `board/viewport.ts`              | Pure: zoom and pan as data (fit, clamp, `zoomAt`, `pinchView`, `panBy`, `cellAt`, `ensureVisible`)                                                                                                                                                                                                                                                                             |
| `board/gestures.ts`              | Pure: pointer events in, `tap`, `pan`, `pinch` and `pinchEnd` actions out                                                                                                                                                                                                                                                                                                      |
| `board/renderer.ts`              | SVG drawing: one `<g data-arrow>` per arrow, exit and bump animations, hint, grid                                                                                                                                                                                                                                                                                              |
| `game/`                          | `PlaySession` (engine state, timer, hints) and `Stopwatch`                                                                                                                                                                                                                                                                                                                     |
| `app.ts`                         | The shell: shows the screen an address names, records level, daily and league results in their stores, pushes the next level onto the history, opens the calendar instead of a day that cannot be opened yet, and shows the league's summary of the last day played once                                                                                                       |
| `screens/home.ts`                | The home screen: wordmark, streak chip, the Levels card with its strip and Play, the Daily, League and Event cards                                                                                                                                                                                                                                                             |
| `screens/calendar.ts`            | The daily calendar: a month in weeks from Monday with stars, today and locked days, month buttons that redraw in place, the trophies row, Play today                                                                                                                                                                                                                           |
| `screens/league.ts`              | The daily league: the league's name and countdown, the rules, the table of 30 with avatars, tags and the dividers where moves happen; the rules and the day's summary in sheets; a 30 s clock that moves the table and settles the day at midnight                                                                                                                             |
| `screens/credits.ts`, `credits/` | The Credits screen; `licences.ts`, the fonts and libraries with their licence files, imported from the packages at build time                                                                                                                                                                                                                                                  |
| `events/`                        | The event catalog (`AUTUMN_2026`: dates, boards in order, the badge), `eventState`, `eventOn`, `daysLeft`                                                                                                                                                                                                                                                                      |
| `league/`                        | `LeagueProvider`, what the screens need of a league; `SimulatedLeagueProvider`, the league against the game's characters on the device (engine `generateSeason`, `standings`, `resolveDay`, `scoreBoard`)                                                                                                                                                                      |
| `daily/`                         | Pure: `days.ts` (local day key, month arithmetic, `DAILY_FIRST_DAY`, which days can be opened) and `month.ts` (the month model, the trophies row, a complete month)                                                                                                                                                                                                            |
| `screens/play.ts`                | The play screen: wires input to the session and results to the renderer, HUD, the lost sheet and the score screen; plays the rewarded ad before a hint and the interstitial before the score                                                                                                                                                                                   |
| `ads/`                           | `AdProvider` (`showInterstitial`, `showRewarded`), `NO_ADS` for the web, `DebugAds` (the test card), `AdMobAds` (iOS: loads ahead, reloads an ad older than 55 minutes) and `adsFor`, which gives the test card when the `arrows.ads` setting asks for it; `AdConsent` (consent.ts), the player's choices about ads before the SDK starts                                      |
| `platform/`                      | `Platform` (the store, the ads, the haptics, the privacy choices): `webPlatform`, and `native.ts`, loaded only in the iOS app, with Capacitor's plugins; `cues.ts` (the five cues, `CuePlayer`, `cuePlayer`, which plays sounds and haptics as the settings allow), `sounds.ts` (`WebAudioSounds`, the cues synthesised with Web Audio), `textSize.ts` (the phone's text size) |
| `persistence/`                   | `KeyValueStore` with `WebStore` (localStorage, never throws), `MemoryStore`, `browserStore()` and `PreferencesStore` (iOS); `RecordSlot`, one versioned JSON record; `ProgressStore` (the level path), `DailyStore` (days won), `LeagueStore` (the player's league and day), `EventStore` (boards won per event) and `SettingsStore` (sound, haptics) on top of it             |
| `levelStrip.ts`                  | Pure: the seven levels around the current one, with their tiers and states                                                                                                                                                                                                                                                                                                     |
| `ui/`                            | HUD (top bar and tool bar, stacked when a title does not fit), `Chances` (the arrowhead lives and their breaking animation), the sheet (lost board, league), `ScoreScreen` (a won board), `SettingsSheet`, DOM helpers                                                                                                                                                         |
| `route.ts`, `puzzles.ts`         | URL to route (home, calendar, league, credits, puzzle: level, daily, event board, drawing), `puzzleKey` (one key per board, for the league's once a day); reference to generated puzzle, with its title and the line under it                                                                                                                                                  |
| `strings.ts`                     | Every player-facing string, keyed, with `{placeholders}`, in English and Brazilian Portuguese; the locale (`localeFor`, `setLocale`), plurals (`tn`), league and drawing names, numbers, number words, ordinals and dates in the player's language                                                                                                                             |

### Progress and navigation

Each record the app keeps lives under its own key as JSON with a `version`, behind a
`RecordSlot`. Progress, under `arrows.progress` with `version: 1`, holds the current level,
the best time per level won, the streak and the best streak, and the levels lost and not won
since (so a win after leaving and coming back is not a first try). Chances belong to a board and
are not stored. `parseProgress` reads field by field and falls back to the initial value for
anything missing or malformed; the place for a migration is marked in it. A record with a newer
version, written by a later build, is never overwritten: an older build plays on in memory.

Daily results, under `arrows.daily` with `version: 1`, hold the best time of each day won, keyed
by day; a lost day is not stored, and a day stored is a star. The calendar's month model reads
the set of days won, and counts only days that can be opened, so a day stored ahead of today (a
changed clock, a bad write) earns nothing until its day comes.

A `RecordSlot` reads the store on every call and writes from what it just read, so a second tab,
or a page the browser kept in its back-forward cache, never writes an out-of-date copy over newer
progress. `WebStore` reads localStorage each time and keeps a write it refuses (a full quota) in
memory for the rest of the visit; `browserStore()` falls back to memory only where touching
localStorage throws.

The play screen reports a result through `record` at the tap that wins or loses, before the last
animation, so leaving during it still counts; `firstTry` is false once a board of that puzzle was
lost while it was open. Only `App` writes the records: levels move the path and the streak, a
replay of a level already won only keeps its best time, a won daily earns its star, and events
are not stored yet.

Links on the home screen and the back button load the page anew, so each adds a history entry; "Next
level" pushes the new address onto the history, and `popstate` shows what the address names. The
calendar's month buttons redraw it in place and replace the address, so Back still leads home. A
daily's back button and its sheets lead to its month in the calendar. An address naming a day ahead
of today, or before the first daily, opens the calendar instead and replaces the address. When the
browser restores a page from its back-forward cache (`pageshow` with `persisted`), or another tab
saves progress (`storage`), `App.refresh` draws the home screen, the calendar or the league again if
one is showing, and puts focus back on the same control; a board in play is left as it is. The
calendar says a new month through a live region, since focus stays on the month button.

The day is the device's local date (`localDateKey`), read from the app's `clock` when a screen is
drawn; date names come from tables in `strings.ts` rather than `Intl`, whose output differs
between engines.

### Daily league

`SimulatedLeagueProvider` keeps only the player's own state, under `arrows.league` with
`version: 1`: the league, the day the points belong to, the points, the keys of the boards that
earned them (`puzzleKey`: each board counts once a day), and the summary of the last day settled
until it is seen. The 29 characters are never stored: `generateSeason(league, day)` makes them
again, and `standings` places them at the local time of day, so the table moves while the app is
open (the league screen redraws every 30 s) and while it is closed.

Every call reads the state and first brings it to today. The first call on a new day settles the
last day played with its final table (`standings` at the end of the day, `resolveDay`,
`nextLeague`) and keeps its summary; a day without a board won changes nothing, and neither do
the days missed between, so several missed days settle once. A stored day after today (a clock
set back) is dropped unsettled. The summary shows once, on the home screen or the league,
whichever comes first.

Until a board is won today the player is not in the day's table: the view lists them last,
without a move, below characters still at 0 (the engine's `standings` would give them the tie).

Two limits are accepted. The home screen does not tick: its League card shows the countdown as it
was when drawn, and the day settles on the next screen drawn (the league screen ticks every
30 s). Where the clocks go back at midnight (Santiago, Asunción, Havana), the local date goes back
an hour: a board won in that hour reads as a clock set back and is dropped, and the repeated
day can settle twice. The day key may move to a fixed time zone later (docs/PRODUCT.md).

The win sheet's league line comes from `App.record`: every board won is scored with
`scoreBoard` (tier, cells, time, chances lost, and the event bonus for event boards). A server-backed
provider can replace the simulated one behind `LeagueProvider` when real players join.

### Events

An event (`events/catalog.ts`) runs from a first to a last local day and lists its boards in
order, each a drawing at a tier with its own seed (`generateBoard` with the id
`event:<event>:<n>`, the `bounds` ray rule). `EventStore` keeps the board numbers won per event
under `arrows.events`. `App` opens an event board only while the event runs, and only up to the
next board not won: an address naming a board further on opens the next one, and one outside
the event's days opens the home screen. A board's first win adds the line "Board 2 of 6 done."
and, on the last, the badge; "Next board" leads on while the event runs. Event boards earn
league points with the event bonus. A win counts for the event, and earns the bonus, only while
the event runs at the moment of the win: a board opened on the last day and won after midnight
is scored as a plain board. The home screen shows the running event, or the one that
ended last: a thumbnail of the next board, a segment per board, and the days left or the end.

### Ads and the score screen

Ads sit behind `AdProvider` (`ads/ads.ts`): `showInterstitial()` resolves when the ad has
closed, `showRewarded()` with whether the reward was earned. `App` takes one and hands it to the
play screen; the platform chooses it (`platform/`, see iOS). The web gets `NO_ADS`, which
resolves at once and grants every reward, so nothing changes for a web player; the iOS app gets
`AdMobAds`. On both, the `arrows.ads` setting, which the puzzle picker keeps in the web view's
storage, swaps in `DebugAds` (`adsFor`): a full-screen card appended to the body, with the rest
of the page `inert` until it closes, counting what it showed in `data-interstitials` and
`data-rewarded` for the end-to-end tests.

The play screen calls the provider in two places only. A hint asks for the rewarded ad first,
unless a hinted arrow is still on the board, which is brought into view again for free; no
reward, no hint. A won board, once its last arrow has left, asks for the interstitial, and the
score screen follows when it closes. A lost board shows its sheet at once. While an ad loads or
plays the board and its bars are `inert` (Back cannot leave the ad to show over another screen),
the Hint button reads "Loading ad…" for a hint's ad, and the timer is held, with the page being
hidden as the other reason to hold it, so a hidden page during an ad does not restart the
clock. An ad that fails (the promise rejects) counts as no reward, or as an interstitial
already over. The board's result is
recorded at the winning tap, before any ad, so leaving during the interstitial loses nothing.

`ScoreScreen` (`ui/score.ts`) covers the play screen until the player moves on. `App.record`
gives it the board's score: `scoreBoard` on the same figures the league records (tier, cells,
time, chances lost, the event bonus while an event runs), shown even when the board already
counted today, when the league line says so instead of giving points.

### Rendering and input

The look is the one of [DESIGN.md](DESIGN.md): Instrument Serif and Geist ship with the build
from their Fontsource packages (`@fontsource/instrument-serif`, latin subset;
`@fontsource-variable/geist`), so the app needs no network for fonts.

The board is SVG in cell units: a cell is 1 by 1, lines run through cell centres with round caps
and joins, so neighbouring paths are a cell apart and never touch. One `transform` on the board
group carries zoom and pan, so strokes scale with the zoom. An arrow leaves along its exit track:
the body line plus the straight run of its ray; a dash the length of the body slides along the
track while the head translates along the ray, so the body follows the head's track.

Input goes through `GestureTracker`. A press that stays within 8 px and lasts under 500 ms is a
tap, resolved to a cell with `cellAt` at the current zoom, then to an arrow with the engine's
`arrowAt`. A pinch step is computed from the view at the start of the pinch: the board point that
was under the fingers goes under their midpoint, at the starting scale times the finger spread,
and the result is clamped once. Computing it step by step instead lets edge clamping move the
board away from the fingers.

### Languages, sound and settings

`main.ts` picks the language before anything draws: `localeFor(navigator.languages)` takes the
first preferred language whose base is Portuguese or English, else English, and sets it in
`strings.ts` and on `<html lang>`. Both tables have the same keys, with the same
placeholders, and a unit test holds them to it. Everything that shows a name, a count, a number
in words, an ordinal or a date goes through `strings.ts`, so the screens never format text
themselves; Portuguese writes a date in full inside a sentence (`formatDayInText`: "2 de
outubro") and has a form for none ("Nenhuma chance restante"). The "AD" mark and the puzzle
picker stay in English (docs/PRODUCT.md, Languages).
League names and drawing names have their own keys; the characters' names stay as they are.
`Info.plist` lists both languages, so iOS shows the app in Portuguese where the phone is.

The five cues (`platform/cues.ts`: an arrow leaving, a blocked tap, a win, a loss, a promotion)
go through one `CuePlayer` that `App` builds from the sounds, the platform's haptics (none on the
web) and `SettingsStore`, read at each cue so a switch takes effect at once. `WebAudioSounds`
synthesises each cue from a few oscillator tones and lets go of their nodes when they end. It
opens its `AudioContext` on the first cue. A browser lets the audio start only after a tap, so
a cue waiting for the audio is dropped once a newer cue comes, or after a second: a promotion as
the page opens is silent in a browser rather than sounding with the next tap, and plays in the
app, whose web view needs no tap. Where Web Audio is missing or fails, cues are silent. The
play screen plays the board's cues, and `App` the promotion, when the league's summary of a
promoted day shows (on the home screen or the league screen). The Settings sheet
(`ui/settings.ts`) opens from the home screen's menu button: a switch per setting (haptics only
in the app), Done, and links to the privacy choices (in the app, where `Platform.privacy` says
the law asks for them, read as the sheet opens), the privacy policy, the credits and the puzzle
picker. Escape closes it from anywhere while it is open.

The Credits screen (`?credits`, `screens/credits.ts`) shows each bundled font and library with
its licence in full, behind a disclosure. `credits/licences.ts` imports the licence files from
the packages themselves (`node_modules/…/LICENSE?raw`), so the screen always shows what the
build bundles. The privacy policy is a page of its own, `privacy.html` (built by Vite like
`dev.html`), written in both languages; `src/privacy.ts` themes it and puts the player's
language first.

### Accessibility

Every control has a name in the player's language, and the screens are tested with Lighthouse
(`pnpm test:a11y`, `apps/game/a11y/`): Playwright starts the production build in Chromium with
a debugging port, and Lighthouse, connected to it through `puppeteer-core`, takes an
accessibility snapshot of each screen and its sheets in turn, in English and in Portuguese
(home, Settings, the day's summary, the calendar, the league and its rules, a board, the test
ad, the lost sheet, the score screen, and the puzzle picker in English). Each must score above
90, and the scores are printed with the audits that fell short. The one that does on every
screen but the picker is `user-scalable=no` in the viewport. It is kept for the app: its web
view honours it (Safari ignores it), so the page never zooms like a web page around the board,
whose own pinch zoom moves only the board, and the text screens follow the phone's text size
instead.

The text size follows Dynamic Type: `platform/textSize.ts` measures WebKit's
`-apple-system-body` font (17 px at the default size), and `main.ts` sets the ratio, from 0.85
to 1.5, as `--text-scale` at start and whenever the app comes back to the front. The root font
size is scaled by it, and the screens are sized in `rem`, except the play screen's bars, whose
type is in pixels (the `.play` rules in `styles.css`), so the board keeps its room; its sheets
and the score are in `rem` like everything else. A few graphic parts keep their size too: the
level strip's numbers and the league's tags, whose meaning the screen reader text carries.
`e2e/fit.spec.ts` holds every text screen (with the home screen in the longest league, every
league, the sheets and the score) and the Hint button in each of its states to the width of a
320, 375 and 390 px phone at 1, 1.25 and 1.5 times, in both languages: no sideways scroll, and
no text spilling out of its box. With large text on a narrow phone the home screen's Daily and
League cards stack (a container query in `rem`; iOS 15, which has none, breaks a long title
inside its card instead). When the board's title or its line would be cut, the HUD moves the
chances and the timer to a row of their own (`Hud.fitTitle`). Reduced motion skips the board's
animations, as before; the hinted arrow and blocked taps are marked by a wider stroke as well
as by colour.

### iOS

The iOS app is the web build in Capacitor 8 (`apps/game/capacitor.config.ts`,
`apps/game/ios/`). The Xcode project uses Swift Package Manager, so there is no CocoaPods:
`cap sync ios` copies `dist/` into `ios/App/App/public` and writes
`ios/App/CapApp-SPM/Package.swift` from the plugins installed (both are Capacitor's to write;
the copied web build and `capacitor.config.json` are not committed). The project is iPhone
only and portrait; Info.plist names AdMob's app id through the `ADMOB_APP_ID` build setting
(Google's test app unless the build passes another), declares no encryption beyond the
system's, and gives Apple's tracking prompt its text (`NSUserTrackingUsageDescription`, in
`en.lproj` and `pt.lproj/InfoPlist.strings` too). `PrivacyInfo.xcprivacy` is the app's privacy
manifest: no tracking and no data collected by the game's own code, and the one required-reason
API it uses, UserDefaults (Capacitor's Preferences), for the app's own data (`CA92.1`). Both are
in the Xcode project's resources.

`main.ts` asks Capacitor whether it runs in the app. In a browser it uses `webPlatform`; in the
app it imports `platform/native.ts`, a chunk of its own, so the web never loads the plugins.
`nativePlatform` reads every saved key from `Preferences` into a `PreferencesStore` before the
app starts (the game reads its records synchronously; writes go to memory at once and are
saved in order behind it), sets the status bar's dark text, asks for the player's choices
about ads and starts AdMob after them (`AdConsent`), preloads both ads (each load waits for the
SDK to have started), and maps the haptic cues to the Taptic Engine
(`impact` light, `notification` warning, success, error, and a heavy impact then success for a
promotion). The page runs under the status bar and the home indicator (`contentInset: 'never'`,
`viewport-fit=cover`) and keeps clear of them with the CSS safe-area insets.

`AdConsent` (`ads/consent.ts`) asks for the player's choices while the game is already
playable: Google's User Messaging Platform first (`requestConsentInfo`, then `showConsentForm`
when a consent message is required and available), Apple's tracking prompt next if it has not
been answered (the consent message's IDFA explainer may already have shown it), and
`initialize` last. `AdMobAds` calls its `ready()` before every load, so no ad is requested
before it resolves. It rejects when the player's choices allow none (`canRequestAds` false) or
when the consent check fails (no network); the next load, when an ad is next needed, runs the
flow again (a consent message then shows at that moment: an ad still loading when the form is
answered is kept for the next one). Where the message says the player needs a way back to the
choices (`privacyOptionsRequirementStatus`), Settings shows Privacy choices, which opens Google's
privacy options form. The plugin as published wires its consent forms only in `initialize`,
which Google's order puts last: `patches/@capacitor-community__admob@8.1.0.patch` (pnpm's
`patchedDependencies`) wires them when the plugin loads, and a unit test reads the installed
source to check the patch is there.

`AdMobAds` loads each kind of ad ahead and shows it when its moment comes. The plugin's show
calls do not say when an ad has gone, so it waits for the `Dismissed` or `FailedToShow` event,
and counts the reward from the `Rewarded` event (or the rewarded show call answering, which it
does only on a reward). An ad not loaded within four seconds is skipped: the interstitial
resolves at once, the rewarded ad rejects, so the hint says no ad could be shown. A load that
failed (no fill, no network) is tried once more within those four seconds; one still loading
when they end is kept for next time, and the next ad loads as soon as one closes. A loaded ad
expires an hour after it loaded, so one loaded more than 55 minutes earlier is loaded again
before it shows, within the same four seconds. The ad units
are Google's iOS sample units unless the web build was made with `VITE_ADMOB_INTERSTITIAL_ID`
and `VITE_ADMOB_REWARDED_ID`; they are requested as they are, never with the plugin's
`isTesting`, which swaps in the plugin's own sample units (its interstitial one is Android's).
Before switching to real units, the owner registers the test iPhone as an AdMob test device, so
tapping its own ads breaks no policy.

Two workflows build it on GitHub's macOS runners with the latest stable Xcode:

- `ios.yml` builds the app for the simulator without signing, on every push to `main` and on
  pull requests that touch the app, the engine or the lockfile.
- `testflight.yml`, run by hand on `main`, signs the app for the App Store and uploads it to
  TestFlight with fastlane (`apps/game/ios/App/fastlane/Fastfile`, lane `beta`). The build number
  is the run number times 100 plus the attempt, so a re-run still counts up. It needs these
  repository secrets, and stops at once, naming the missing ones, without them; the three AdMob
  ones go together or not at all, since real units serve only under their own AdMob app:

| Secret                                  | What it is                                                             |
| :-------------------------------------- | :--------------------------------------------------------------------- |
| `APPLE_TEAM_ID`                         | The Apple Developer team that owns the app                             |
| `APP_STORE_CONNECT_API_KEY_ID`          | An App Store Connect API key with the App Manager role: its key id     |
| `APP_STORE_CONNECT_API_ISSUER_ID`       | The key's issuer id                                                    |
| `APP_STORE_CONNECT_API_KEY_P8`          | The key's `.p8` file, base64                                           |
| `IOS_DISTRIBUTION_CERTIFICATE_P12`      | An Apple Distribution certificate with its private key, `.p12`, base64 |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | The `.p12`'s password                                                  |
| `ADMOB_APP_ID` (optional)               | The AdMob app id (`ca-app-pub-…~…`); Google's test app without it      |
| `ADMOB_INTERSTITIAL_ID` (optional)      | The AdMob interstitial unit; Google's test unit without it             |
| `ADMOB_REWARDED_ID` (optional)          | The AdMob rewarded unit; Google's test unit without it                 |

Before the first run the owner registers the app id `net.jonathas.arrows` under
Certificates, Identifiers & Profiles and creates the app in App Store Connect with it; the lane
creates the App Store provisioning profile itself.

The API key and the distribution certificate belong to the owner's Apple Developer team, not to
this app: the owner's other apps (Trilha, already on TestFlight, and the games to come) sign and
upload with the same ones, so neither is revoked or replaced for this app alone, and each game's
repository holds the same six required secrets (only the AdMob ones differ). The lane neither
creates nor revokes certificates: it imports the one it is given into a temporary keychain, and
creates or downloads only this app's profile.

### Store

[STORE.md](STORE.md) lists what the App Store needs and the owner's steps. The listing's text,
in English and Portuguese, is in `apps/game/ios/App/fastlane/metadata`, and its screenshots in
`fastlane/screenshots`. `pnpm store:screenshots` makes them: Playwright drives the production
build at 430 by 932 points at 3× (1290 by 2796 pixels) through six screens of a player a few
weeks in (`apps/game/store/screenshots.spec.ts`, `playwright.store.config.ts`). The page's
clock is paused at a fixed date and moves only when the script runs it (ahead after a board's
first tap, so its timer shows a time, and a second before each picture), so every run takes
the same pictures, byte for byte. Two more workflows run by hand:

- `app-store-listing.yml` uploads the text and the screenshots with fastlane (`deliver`, lane
  `listing`), with the App Store Connect API key of the TestFlight workflow. It uploads no build
  and submits nothing.
- `pages.yml` builds the web app for GitHub Pages and publishes the privacy policy page, the
  icon and the build's `assets` folder, at the address the listing gives. The folder holds the
  game's scripts too, but none of the game's pages is published.

## Enforced rules

| Rule                                 | Enforced by                                                                        |
| :----------------------------------- | :--------------------------------------------------------------------------------- |
| No `Math.random` anywhere            | ESLint `no-restricted-properties` (`repo/no-math-random`)                          |
| Engine has no browser globals        | ESLint `no-restricted-globals` (`repo/engine-purity`)                              |
| Engine never imports the app         | ESLint `no-restricted-imports` (`repo/engine-purity`)                              |
| Every generated puzzle is solvable   | `generatePuzzle` throws otherwise; property tests over thousands of seeds          |
| Tiers stay in their bands            | `levels.calibration.test.ts` over levels 1 to 400                                  |
| League promotion rates stay in bands | `league.calibration.test.ts` over 120 simulated days per league                    |
| Level content does not drift         | Fingerprint pins in `levels.test.ts`                                               |
| Drawings are what the art makes      | `pnpm drawings:check` in CI; `tools/drawings.test.ts` round-trips every PNG        |
| Colours only in the theme            | ESLint `no-restricted-syntax` (`repo/theme-colours`); `styles.test.ts` for the CSS |
| Web never loads the native plugins   | ESLint `no-restricted-imports` (`repo/native-plugins`): only `platform/native.ts`  |
| Web build under 300 kB gzipped       | The `arrows:size-budget` plugin in `apps/game/vite.config.ts` fails the build      |
| Both languages have every string     | `strings.test.ts`: the same keys and placeholders, no English words left in pt     |
| Lighthouse accessibility above 90    | `pnpm test:a11y` (`apps/game/a11y/lighthouse.spec.ts`) in the e2e CI job           |
| Text screens fit at every text size  | `e2e/fit.spec.ts`: 320 to 390 px wide, 1 to 1.5 times, English and Portuguese      |

## Testing

- `pnpm test`: unit and property tests, in seconds, on every commit (Husky) and in CI.
- `pnpm test:calibration`: the long suites, in their own CI job.
- `pnpm test:e2e`: Playwright against the production build, on a touch phone profile
  (390 by 844) and a desktop profile. The tests use the engine as their oracle: the page and the
  test generate the same puzzle from the same seed, so a test knows which arrows are free or
  blocked without the page exposing it. Claude Code cloud sessions use the Chromium at
  `/opt/pw-browsers/chromium` and must not run `playwright install`; CI installs its own.
- `pnpm test:a11y`: Lighthouse's accessibility audit of every screen of the production build,
  in the same CI job as the end-to-end tests.

Tests are next to the code (`*.test.ts`), calibration suites are `*.calibration.test.ts`, and the
app's end-to-end specs are in `apps/game/e2e/`.
