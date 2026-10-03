import { generateLevel } from '@arrows/engine';
import { expect, press, solveWithHints, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

// The table depends on the day and the time of day: pin both, and the zone.
test.use({ timezoneId: 'Europe/Lisbon' });
const NOW = new Date('2026-10-14T16:12:00+01:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

async function storeLeague(page: Page, state: object): Promise<void> {
  await page.evaluate(
    (json) => localStorage.setItem('arrows.league', json),
    JSON.stringify({
      version: 1,
      league: 0,
      day: null,
      points: 0,
      boards: [],
      summary: null,
      ...state,
    }),
  );
}

test('the table lists 30 with the player, the characters and where moves happen', async ({
  page,
}) => {
  await page.goto('./?league');
  await expect(page.locator('h1')).toHaveText('Daily league');
  await expect(page.locator('.league-name')).toHaveText('Bronze');
  await expect(page.locator('.league-reset')).toHaveText('Resets in 7h 48m');
  await expect(page.locator('.league-rules')).toContainText('Top 10 move up to Silver.');
  await expect(page.locator('.league-rules')).toContainText('the game’s characters');
  await expect(page.locator('.league-join')).toBeVisible();
  await expect(page.locator('.league-row')).toHaveCount(30);
  await expect(page.locator('.league-row[data-kind="character"] .tag').first()).toHaveText(
    'character',
  );
  // Not joined yet: last, no rank, no move.
  const player = page.locator('.league-row[data-kind="player"]');
  await expect(player.locator('.row-name')).toHaveText('You');
  await expect(player).toHaveAttribute('data-rank', '30');
  await expect(player).toHaveAttribute('data-zone', 'stay');
  await expect(player.locator('.rank')).toHaveText('–');
  await expect(player).toBeInViewport();
  await expect(page.locator('.league-divider')).toHaveText(['Above moves up']);

  // A league with both moves has both dividers.
  await storeLeague(page, { league: 2, day: '2026-10-14' });
  await page.reload();
  await expect(page.locator('.league-name')).toHaveText('Gold');
  await expect(page.locator('.league-divider')).toHaveText(['Above moves up', 'Below moves down']);
  // The page never scrolls sideways.
  const widths = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(widths[0]).toBe(widths[1]);
});

test('a won board earns points and a place in the table', async ({ page, touch }) => {
  await page.goto('./?level=1');
  await solveWithHints(page, touch, generateLevel(1).puzzle);
  await expect(page.locator('.overlay[data-overlay="won"]')).toContainText(
    /\+\d+ points in Bronze league · now \d+(st|nd|rd|th)\./,
  );
  await page.goto('./?league');
  await expect(page.locator('.league-join')).toBeHidden();
  const score = page.locator('.league-row[data-kind="player"] .score');
  await expect(score).not.toHaveText('0');
  await page.goto('./');
  await expect(page.locator('a.league .card-title')).toHaveText(/^Bronze · \d+(st|nd|rd|th)$/);
  await expect(page.locator('a.league .card-note')).toHaveText('Resets in 7h 48m');
});

test('a winning day moves the player up, and the summary says so once', async ({ page, touch }) => {
  await page.goto('./');
  // Yesterday: more points than any character in Bronze.
  await storeLeague(page, { day: '2026-10-13', points: 99_999, boards: ['level:12'] });
  await page.reload();
  const sheet = page.locator('.overlay[data-overlay="summary"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading')).toHaveText('While you were away');
  await expect(sheet).toContainText(
    'You finished 1st in Bronze on Tue 13 Oct, with 99999 points, and moved up to Silver.',
  );
  await expect(page.locator('a.league .card-title')).toHaveText('Silver');
  await press(sheet.getByRole('button', { name: 'Continue' }), touch);
  await expect(sheet).toHaveCount(0);

  // Seen once: not again, on the home screen or in the league.
  await page.reload();
  await expect(page.locator('.overlay[data-overlay="summary"]')).toHaveCount(0);
  await press(page.locator('a.league'), touch);
  await expect(page).toHaveURL(/\?league$/);
  await expect(page.locator('.league-name')).toHaveText('Silver');
  await expect(page.locator('.overlay')).toBeHidden();
  await expect(page.locator('.league-rules')).toContainText(
    'Top 10 move up to Gold, bottom 10 move down to Bronze.',
  );
});

test('the summary shows in the league too, and the rules open on the info button', async ({
  page,
  touch,
}) => {
  await page.goto('./?league');
  await storeLeague(page, { league: 3, day: '2026-10-12', points: 3, boards: ['level:1'] });
  await page.reload();
  const sheet = page.locator('.overlay');
  await expect(sheet).toHaveAttribute('data-overlay', 'summary');
  await expect(sheet).toContainText('and moved down to Gold.');
  await press(sheet.getByRole('button', { name: 'Continue' }), touch);
  await expect(sheet).toBeHidden();
  await expect(page.locator('.league-name')).toHaveText('Gold');

  await press(page.getByRole('button', { name: 'How the league works' }), touch);
  await expect(sheet).toHaveAttribute('data-overlay', 'rules');
  await expect(sheet).toContainText('Each board counts once a day.');
  await press(sheet.getByRole('button', { name: 'Got it' }), touch);
  await expect(sheet).toBeHidden();
});

test.describe('on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('every name reads in full, and the page never scrolls sideways', async ({ page }) => {
    await page.goto('./?league');
    await storeLeague(page, { league: 6, day: '2026-10-14', points: 12_345, boards: ['level:1'] });
    await page.reload();
    await expect(page.locator('.league-row')).toHaveCount(30);
    const cut = await page
      .locator('.row-name')
      .evaluateAll((names) =>
        names
          .filter((name) => name.scrollWidth > name.clientWidth + 1)
          .map((name) => name.textContent),
      );
    expect(cut).toEqual([]);
    // Room for a name: the tag sits under it rather than beside it (it once left 41 px).
    const narrowest = await page
      .locator('.row-who')
      .evaluateAll((cells) => Math.min(...cells.map((cell) => cell.clientWidth)));
    expect(narrowest).toBeGreaterThanOrEqual(100);
    const widths = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(widths[0]).toBe(widths[1]);
    // Five-digit scores fit their column.
    const scores = await page
      .locator('.league-row .score')
      .evaluateAll(
        (cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).length,
      );
    expect(scores).toBe(0);
  });
});
