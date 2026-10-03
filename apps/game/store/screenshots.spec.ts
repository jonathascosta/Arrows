import { createGame, freeArrows, generateLevel, tap } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The App Store screenshots (docs/STORE.md): six screens of a player a few weeks
 * in, on 18 November 2026, while the Autumn event runs. `pnpm store:screenshots`.
 */
const OUT = 'ios/App/fastlane/screenshots';
const NOW = new Date('2026-11-18T10:00:00');

const LANGUAGES = [
  { locale: 'en-US', folder: 'en-US' },
  { locale: 'pt-BR', folder: 'pt-BR' },
];

/** Every day of October won (a trophy), and most of November so far. */
function daysWon(): string[] {
  const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const november = [1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17].map(
    (day) => `2026-11-${String(day).padStart(2, '0')}`,
  );
  return [...october, ...november];
}

async function seed(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate((days) => {
    const today = '2026-11-18';
    localStorage.setItem(
      'arrows.progress',
      JSON.stringify({ version: 1, currentLevel: 37, streak: 12, bestStreak: 15, bestTimes: {} }),
    );
    localStorage.setItem(
      'arrows.daily',
      JSON.stringify({
        version: 1,
        days: Object.fromEntries(days.map((day) => [day, { bestMs: 95_000 }])),
      }),
    );
    localStorage.setItem(
      'arrows.league',
      JSON.stringify({
        version: 1,
        league: 2,
        day: today,
        points: 2_150,
        boards: ['level:36', 'daily:2026-11-18'],
        summary: null,
      }),
    );
    localStorage.setItem(
      'arrows.events',
      JSON.stringify({
        version: 1,
        events: { 'autumn-2026': Array.from({ length: 180 }, (_, i) => i + 1) },
      }),
    );
  }, daysWon());
}

/** Taps the arrowhead of an arrow, as a finger would. */
async function tapArrow(page: Page, id: number): Promise<void> {
  const box = await page.locator(`[data-arrow="${id}"] .head`).boundingBox();
  if (box === null) throw new Error(`Arrow ${id} is not on screen`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Takes `count` free arrows off the board (all of them when no count is given),
 * as if `elapsed` had passed since the first tap, which starts the timer.
 */
async function clear(page: Page, puzzle: Puzzle, elapsed: string, count = Infinity): Promise<void> {
  let game = createGame(puzzle);
  for (let i = 0; i < count && game.status === 'playing'; i++) {
    const id = freeArrows(game)[0]!;
    await tapArrow(page, id);
    if (i === 0) await page.clock.runFor(elapsed);
    game = tap(game, id).state;
    await expect(page.locator('.play')).toHaveAttribute(
      'data-arrows-left',
      String(game.remaining.size),
    );
  }
}

/**
 * Waits for the fonts, lets the page's clock run a second for any animation
 * (time moves only when the script says so, so every run takes the same
 * pictures), then takes the screen.
 */
async function shoot(page: Page, folder: string, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(1000);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${folder}/${name}.png` });
}

for (const { locale, folder } of LANGUAGES) {
  test.describe(locale, () => {
    test.use({ locale });

    test(`the App Store screenshots in ${locale}`, async ({ page }) => {
      // The page's time stands at NOW and moves only when the script runs it: ahead
      // where a board needs a time on its clock, and a second before each picture.
      await page.clock.install({ time: NOW });
      await page.clock.pauseAt(NOW);
      await seed(page);

      // 1. A board in play, a few arrows already out.
      await page.goto('./?level=37');
      await clear(page, generateLevel(37).puzzle, '00:47', 6);
      await shoot(page, folder, '1-board');

      // 2. Home: the level path, the daily, the league and the event.
      await page.goto('./');
      await expect(page.locator('.levels-card')).toBeVisible();
      await shoot(page, folder, '2-home');

      // 3. The daily calendar: stars, and October's trophy.
      await page.goto('./?calendar');
      await expect(page.locator('.trophy.complete')).toBeVisible();
      await shoot(page, folder, '3-daily');

      // 4. The league table.
      await page.goto('./?league');
      await expect(page.locator('.league-row')).toHaveCount(30);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shoot(page, folder, '4-league');

      // 5. An event board drawn as a picture.
      await page.goto('./?event=autumn-2026&board=181');
      await expect(page.locator('[data-arrow]').first()).toBeVisible();
      await shoot(page, folder, '5-event');

      // 6. The score of the board from the first screen, won: a new level, so the streak grows.
      await page.goto('./?level=37');
      await clear(page, generateLevel(37).puzzle, '02:41');
      // The last arrow leaves, the board settles, and the score comes.
      await page.clock.runFor(3000);
      await expect(page.locator('.score-screen')).toBeVisible();
      await shoot(page, folder, '6-score');
    });
  });
}
