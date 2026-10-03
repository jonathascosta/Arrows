import { createGame, freeArrows, generateLevel, LEAGUES } from '@arrows/engine';
import type { Page } from '@playwright/test';
import { expect, press, solveWithHints, storeProgress, tapArrow, test } from './fixtures.ts';

/**
 * The text screens fit a phone, in both languages, from the smallest iPhone
 * width to the common one, at the default text size and at the largest the
 * game follows (docs/PRODUCT.md, Accessibility): no sideways scroll, and no
 * text spilling out of its box.
 */
const WIDTHS = [320, 375, 390];
const SCALES = [1, 1.25, 1.5];
const LANGUAGES = [
  { locale: 'en-US', settings: 'Settings', hint: 'Hint', watch: 'Watch to the end' },
  { locale: 'pt-BR', settings: 'Ajustes', hint: 'Dica', watch: 'Assistir até o fim' },
];

/** What does not fit: the page wider than the screen, or an element narrower than its content. */
async function misfits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) found.push(`the page is ${root.scrollWidth} px wide`);
    for (const element of document.querySelectorAll('body *')) {
      // Screen reader text is clipped to a pixel on purpose.
      if (!(element instanceof HTMLElement) || element.closest('.sr-only') !== null) continue;
      if (element.getClientRects().length === 0) continue;
      if (element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0) {
        const text = element.textContent.trim().slice(0, 40);
        found.push(`.${element.className} (${element.clientWidth} px): “${text}”`);
      }
    }
    return found;
  });
}

/** Checks the screen as it is at every width and text size. */
async function expectFits(page: Page, screen: string): Promise<void> {
  const problems: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 700 });
    for (const scale of SCALES) {
      await page.evaluate((value) => {
        document.documentElement.style.setProperty('--text-scale', String(value));
      }, scale);
      for (const problem of await misfits(page)) {
        problems.push(`${screen} at ${width} px, ×${scale}: ${problem}`);
      }
    }
  }
  expect(problems).toEqual([]);
}

/** The player in a league today, with a board won, so the table has their row. */
async function storeLeague(page: Page, league: number): Promise<void> {
  await page.evaluate((index) => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    localStorage.setItem(
      'arrows.league',
      JSON.stringify({
        version: 1,
        league: index,
        day,
        points: 12_345,
        boards: ['level:900'],
        summary: null,
      }),
    );
  }, league);
}

for (const { locale, settings, hint, watch } of LANGUAGES) {
  test.describe(`in ${locale}`, () => {
    test.use({ locale });

    test.beforeEach(async ({ page, isMobile }) => {
      // The widths are a phone's; the desktop profile adds nothing here.
      test.skip(!isMobile, 'phone widths only');
      // While the Autumn event runs, so the home screen has all its cards.
      await page.clock.setFixedTime(new Date('2026-11-18T10:00:00'));
    });

    test('home and Settings fit', async ({ page, touch }) => {
      await page.goto('./');
      await storeProgress(page, { currentLevel: 998, streak: 123 });
      await page.reload();
      await expectFits(page, 'home');
      await page.setViewportSize({ width: 390, height: 700 });
      await press(page.getByRole('button', { name: settings }), touch);
      await expect(page.locator('[data-overlay="settings"]')).toBeVisible();
      await expectFits(page, 'Settings');
      // In the league with the longest name, joined: its card shows the name and the rank.
      await storeLeague(page, LEAGUES.indexOf('Diamond'));
      await page.reload();
      await expectFits(page, 'home in Diamond');
    });

    test('the calendar fits', async ({ page }) => {
      await page.goto('./?calendar=2026-09');
      await expect(page.locator('#month-title')).toBeVisible();
      await expectFits(page, 'calendar');
    });

    test('every league fits', async ({ page, touch }) => {
      await page.goto('./');
      for (const [index, name] of LEAGUES.entries()) {
        await storeLeague(page, index);
        await page.goto('./?league');
        await expect(page.locator('.league-screen')).toHaveAttribute('data-league', name);
        await expectFits(page, name);
      }
      await press(page.locator('.league-screen .info'), touch);
      await expect(page.locator('.overlay .sheet')).toBeVisible();
      await expectFits(page, 'the league rules');
    });

    test('the Hint button fits in each of its states', async ({ page, touch }) => {
      // Test ads: the rewarded ad waits for the player, as a network ad loads.
      await page.goto('./');
      await page.evaluate(() => localStorage.setItem('arrows.ads', 'test'));
      await page.goto('./?level=1');
      await expectFits(page, 'Hint');
      await press(page.getByRole('button', { name: new RegExp(`^${hint}`) }), touch);
      await expect(page.locator('.test-ad')).toBeVisible();
      await expect(page.locator('.hint .ad-badge')).toBeHidden();
      await expectFits(page, 'Hint, loading its ad');
      await page.setViewportSize({ width: 390, height: 844 });
      await press(page.getByRole('button', { name: watch }), touch);
      await expect(page.locator('.hint.shown')).toBeVisible();
      await expectFits(page, 'Hint, shown');
    });

    test('the lost sheet and the score screen fit', async ({ page, touch }) => {
      const level = 120;
      const { puzzle } = generateLevel(level);
      const game = createGame(puzzle);
      const free = new Set(freeArrows(game));
      const blocked = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
      await page.goto(`./?level=${level}`);
      for (let i = 0; i < game.livesAtStart; i++) await tapArrow(page, touch, blocked);
      await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
      await expectFits(page, 'the lost sheet');

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('./?level=1');
      await solveWithHints(page, touch, generateLevel(1).puzzle);
      await expect(page.locator('.score-screen')).toBeVisible();
      await expectFits(page, 'the score screen');
    });
  });
}
