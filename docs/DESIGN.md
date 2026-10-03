# Design

The visual direction delivered by Claude Design, written down so every task builds to it.
[PRODUCT.md](PRODUCT.md) says what the game does; this file says how it looks. When the design
changes, change this file first, then the theme in `apps/game/src/theme/`.

## Direction

Warm paper and ink. Cream backgrounds, near-black strokes, a condensed serif for titles and a
quiet grotesque for everything else. Colour is used sparingly: the tier as an accent, orange for
stars and hints, red for a blocked tap, and the drawing palette on event boards.

What the design deliberately does not do, to stay clear of the reference game: no water drops
(lives are **chances**, drawn as arrowheads), no centred title over a row of lives and a timer
pill, no mint green.

## Type

| Role  | Font             | Licence       | Use                                                          |
| :---- | :--------------- | :------------ | :----------------------------------------------------------- |
| Title | Instrument Serif | SIL Open Font | Screen titles, level names, big numbers ("Solved", scores)   |
| UI    | Geist            | SIL Open Font | Everything else; tier labels in small caps with wide spacing |

Both are free to bundle in the app. They ship with the build from the Fontsource packages
(`@fontsource/instrument-serif`, latin subset, and `@fontsource-variable/geist`), not from a CDN;
their licence files are in those packages and go into the app's credits in T10.

## Tokens

The theme object in `apps/game/src/theme/` carries these names and values.

| Token           | Value     | Use                                                                            |
| :-------------- | :-------- | :----------------------------------------------------------------------------- |
| `background`    | `#F4F0E8` | Screens                                                                        |
| `surface`       | `#E9E3D6` | Quiet surfaces: round back buttons, chips, day cells                           |
| `surfaceRaised` | `#FCFAF6` | Cards, sheets, tool bar buttons, the player's league row                       |
| `shadow`        | layered   | Soft layered shadow under raised surfaces (provisional values in `default.ts`) |
| `text`          | `#2A2723` | Body text                                                                      |
| `textMuted`     | `#6E675C` | Secondary text                                                                 |
| `title`         | `#1E1B17` | Titles                                                                         |
| `divider`       | `#DDD5C6` | Hairlines, card separators                                                     |
| `stroke`        | `#2B2925` | Arrow bodies on plain boards                                                   |
| `head`          | `#2B2925` | Arrowheads on plain boards                                                     |
| `hint`          | `#C9741F` | Hinted arrow, stars, small accents                                             |
| `grid`          | `#E8E1D3` | Cell grid under the board                                                      |
| `chance`        | `#2B2925` | Intact chance                                                                  |
| `chanceLost`    | `#D6CEBF` | Lost chance; the faded board after a loss                                      |
| `blocked`       | `#B93D2A` | Blocked arrow flash, breaking chance                                           |
| `primary`       | `#2B2925` | Primary buttons                                                                |
| `onPrimary`     | `#FCFAF6` | Text on primary buttons                                                        |
| `focus`         | `#C9741F` | Keyboard focus ring (not in the delivery; the hint colour, 3:1)                |
| `tierEasy`      | `#3D784B` | Tier accents (design: `#3F7D4E`, darkened for 4.5:1)                           |
| `tierMedium`    | `#3C6FA0` |                                                                                |
| `tierHard`      | `#7A4FA6` |                                                                                |
| `tierSuperHard` | `#A83E34` |                                                                                |
| `drawing1`      | `#D9822B` | Event board palette: orange                                                    |
| `drawing2`      | `#C9A227` | yellow                                                                         |
| `drawing3`      | `#7A4E2D` | brown                                                                          |
| `drawing4`      | `#4F8A5B` | green                                                                          |

Every text pairing meets WCAG AA (4.5:1; 3:1 only for the large serif titles), and every icon,
focus ring and arrow stroke on plain boards meets 3:1. `apps/game/src/theme/contrast.test.ts`
checks each pairing the screens use. Only `tierEasy` needed a change for that. The drawing palette
is the exception: `drawing1` (orange, 2.57:1) and `drawing2` (yellow, 2.13:1) stay below 3:1 on the
background, as delivered; the test lists them as known gaps (see the open points). A lost chance in
`chanceLost` is deliberately faint (1.37:1): its split shape, not its colour, carries the state.

Tier colour appears only as an accent: the tier label, the tier badge, the level strip. Never as
the arrow stroke and never as a board tint, because the stroke colour already carries the drawing
palette and the hint and blocked states.

## Board

Stroke `0.12` of a cell, round cap and round join, lines through cell centres. Arrowhead: a
sharp-cornered triangle, tip `0.42` from the head cell's centre, length `0.42` (so its base sits
on the centre), width `0.34`. The grid is a hairline in `grid`.

## Chances

Three chances per board, drawn as the board's own arrowhead, in a row next to the timer.

| State    | Look                                                   |
| :------- | :----------------------------------------------------- |
| Intact   | Solid triangle in `chance`                             |
| Breaking | The triangle split along its axis, halves in `blocked` |
| Lost     | The two halves, twisted apart, in `chanceLost`         |

A blocked tap flashes the tapped arrow in `blocked` and breaks the rightmost intact chance: the
head splits along its axis, both halves twist apart and settle in `chanceLost`, over about
300 ms. With reduced motion the chance changes state at once and the red is held for the same
time. A lost chance differs from an intact one by shape as well as colour.

## Screens

### Board, in play

- Top: a round back button on `surface`; the title left-aligned in Instrument Serif ("Level
  42", or the drawing's name); the tier under it in small caps in the tier colour (for events:
  "SPRING EVENT · 5 OF 12").
- Top right: the three chances, a hairline divider, the timer (`01:12`) in Geist, tabular
  figures, no pill.
- The board fills the middle.
- Bottom tool bar, two raised buttons: **Grid** (icon and label) and a wider **Hint** with an
  `AD` badge at its end, since a hint always plays a rewarded ad. After a hint the button reads
  "Hint shown".

### Win, the score screen (after the interstitial)

- Tier line in small caps: "LEVEL 42 · MEDIUM".
- "Solved" in large Instrument Serif; one line under it, such as "First try. Win streak is now 6."
- A raised card with three rows separated by hairlines: Time (with "best 01:31" in muted text
  and the time on the right), Chances lost ("1 of 3"), Score (large serif figure).
- One line with an orange dot: "+38 points in Gold league · now 8th".
- Primary button "Next level" (or "Play again" off the level path), text button "Home".

### Lose

- The board stays visible, faded to `chanceLost`; the chances all lost; the timer frozen.
- A bottom sheet on `surfaceRaised`: "Out of chances" in serif, "Retry plays the same puzzle
  again, with three fresh chances and the timer reset.", primary "Retry", text button "Home".

### Home

- "Arrows" wordmark in Instrument Serif; top right a "Streak 6" chip and a menu button.
- **Levels card**: label "Levels", the tier badge (outlined, tier colour), "Level 42" in serif, a
  strip of seven levels around the current one (finished levels filled in their tier colour, the
  current one as a ring in its tier colour, upcoming ones as pale rings, joined by a line), and a
  full-width primary "Play".
- Two half cards: **Daily** ("Sat 3 Oct", "★ 2 of 31") and **League** ("Gold · 8th", "Resets in
  7h 48m").
- **Event card**: a thumbnail of the drawing board, "Spring event", the drawing's name in serif, a
  progress bar, "4 of 12 boards · 3 days left".

Until T6 fills it, the event card is a placeholder: it opens the butterfly at Hard. The menu
button opens the puzzle picker until there is a menu. The level strip is not tappable: Play
opens the current level.

### Daily challenge

- Round back button, title "Daily challenge" in serif.
- Month header with previous and next buttons (next disabled past the current month), "October
  2026", "2 of 31 stars".
- Week starts on Monday (M T W T F S S). Day cells are rounded squares: finished days raised with
  an orange star, today outlined in `primary` with a dot, future days muted and not tappable.
- **Trophies** row: one card per past month, a trophy for a complete month, a dashed card with
  "29 of 30" for a month missed by a few days.
- Bottom primary button "Play today", with the board under it in small text ("Weekend board ·
  Hard · 18 × 27", from the engine).

As built in T4: days not won yet sit on `surface`; days ahead are bare muted numbers; the month
buttons are round buttons, the disabled one faded. The trophies row shows the current month once
it is complete and each earlier month with at least one star, and scrolls sideways; before any,
it says how to earn a trophy. "Play today" is left out while the device's clock is before the
first daily. A daily's back button and its sheets' second link ("Calendar") lead to its month.
The trophy is the `hint` colour, like the stars. The home screen's Daily card opens the calendar
and shows the month's stars ("★ 10 of 31").

### Daily league

- Round back button, title "Daily league" in serif, an info button for the rules.
- The league name in large serif ("Gold"), "Resets in 7h 48m" on the right.
- One paragraph of rules, always visible: "Top 10 move up to Platinum, bottom 10 move down to
  Silver. You're playing against the game's characters until the league has players."
- Rows: rank, a round avatar with initials on a palette colour, the name, a `character` tag, the
  score right-aligned. The player's row is raised, with a dark avatar and "You".
- Labelled dividers after rank 10 ("ABOVE MOVES UP") and before rank 21 ("BELOW MOVES DOWN").

As built in T5: the rows sit on the page, the player's raised on `surfaceRaised`; the avatar
colours are the `avatars` tokens (the tier colours, the drawings' brown, a teal and a rust, each
reaching 4.5:1 under initials in `onPrimary`), picked by the character's name; the player's
avatar is `primary` with "Y". The tag is an outlined pill. Bronze has no bottom divider and
Legend no top one, and the rules paragraph says so. Before a board is won today, "Win a board
today to join the table." shows under the rules. The info button opens the rules in a sheet; the
day's summary ("While you were away") is a sheet too, on the home screen or here. The home
screen's League card shows "Gold · 8th" and "Resets in 7h 48m" once a board is won today, and
"Win a board to join today" before.

## Screenshots

What the build looks like at 390 by 844, task by task, in [screenshots/](screenshots/).

## Open points

- `shadow`: the delivery says "layered"; `default.ts` sets provisional values to confirm with
  the design.
- Drawing contrast: orange (2.57:1) and yellow (2.13:1) arrows are below 3:1 on the paper
  background. A darker pair would read better on event boards; owner and design to decide.
- Hint on drawings: the hint colour against the orange of the drawings is 1.20:1, so with reduced
  motion (no pulse) a hinted orange arrow barely stands out on the butterfly. A hint treatment that
  does not rely on colour alone (a halo, a thicker stroke) is worth designing.
- Drawing palette: four colours are defined. Drawings that need more (the heart needs red) take
  `drawing5` onwards, still to be designed; until then red maps to `tierSuperHard`.
- Chance direction: the chances point right, like the board's heads. Pointing them up was
  suggested, so that two intact ones next to a timer do not read as a fast-forward button. It is
  one theme value (`chanceDirection: 'up'`) if the owner prefers it.
- Character avatars: the design uses initials on colour; illustrated avatars stay for later.
- Home menu: the design shows a menu button but no menu. Until one is designed it opens the
  puzzle picker (`dev.html`), also in release builds; hiding it there is one line if the owner
  prefers.
