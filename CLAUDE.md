# Arrows

Read `docs/PRODUCT.md` (what we build), `docs/ARCHITECTURE.md` (how) and `docs/PLAN.md` (what
is next, and what done means) before changing anything.

## Workflow

- One task of `docs/PLAN.md` per pull request.
- Every pull request goes through an isolated review agent (its own worktree, no session
  context). Fix what it finds, ask it to review again, and repeat until it approves. Then post
  one comment on the pull request recording the rounds. Only the owner merges.
- When the owner merges, continue with the next open task of the plan from the updated `main`.

## Commands

- `pnpm test` — unit and property tests (seconds). Run before every commit.
- `pnpm test:calibration` — difficulty and league bands (about 10 s). Run after touching the
  generator, the tiers, the solver or the league.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck` — the same gates as CI and the pre-commit hook.
- `pnpm dev` — the app at http://localhost:5173 (`/dev.html` opens any puzzle by seed).
- `pnpm test:e2e` — Playwright on the production build, phone and desktop profiles. In cloud
  sessions it uses the Chromium at `/opt/pw-browsers/chromium`; never run `playwright install`.

## Rules

- Every random draw goes through a seeded `Rng` (`packages/engine/src/rng`). `Math.random` fails lint.
- The engine (`packages/engine`) has no dependencies and no DOM. Rendering, input, persistence
  and ads live in the app.
- A change that alters generated content (RNG, partition, peel, tiers, band selection) changes
  every player's level N. The fingerprint test in `levels.test.ts` will fail: update it only on
  purpose and say so in the commit message.
- Keep the product document current: when behaviour changes, change `docs/PRODUCT.md` first.
- In code and CSS, colours live in `apps/game/src/theme/` only; lint and a CSS test reject them
  elsewhere. Static files in `apps/game/public/` (the favicon) are exempt and keep the theme's
  colours by hand.
- Code, comments and documents are in English; player-facing text goes through `strings.ts`.
