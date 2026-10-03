import { createGame, freeArrows, generateLevel, tap } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
import type { Page } from '@playwright/test';
import { expect, play, press, solveWithHints, tapArrow, test } from './fixtures.ts';

const ADS_KEY = 'arrows.ads';

/** Wins the open board by tapping free arrows, without a hint. */
async function solveByTaps(page: Page, touch: boolean, puzzle: Puzzle): Promise<void> {
  let game = createGame(puzzle);
  while (game.status === 'playing') {
    const id = freeArrows(game)[0]!;
    await tapArrow(page, touch, id);
    game = tap(game, id).state;
    await expect(play(page)).toHaveAttribute('data-arrows-left', String(game.remaining.size));
  }
}

/** Taps an arrow that is blocked at the start until the board is lost. */
async function loseBoard(page: Page, touch: boolean, puzzle: Puzzle): Promise<void> {
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  for (let i = 0; i < game.livesAtStart; i++) await tapArrow(page, touch, id);
  await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
}

test('the web build shows no ad: hints come at once, the score right after the win', async ({
  page,
  touch,
}) => {
  await page.goto('./?level=1');
  await solveWithHints(page, touch, generateLevel(1).puzzle);
  await expect(page.locator('.score-screen')).toBeVisible();
  await expect(page.locator('.test-ad')).toHaveCount(0);
});

test.describe('with test ads on', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate((key) => localStorage.setItem(key, 'test'), ADS_KEY);
  });

  test('a rewarded ad plays before every hint, and one interstitial before each score', async ({
    page,
    touch,
  }) => {
    const ad = page.locator('.test-ad');
    const score = page.locator('.score-screen');
    const { puzzle } = generateLevel(1);
    await page.goto('./?level=1');
    for (let move = 1; move <= puzzle.arrows.length; move++) {
      await press(page.locator('.toolbar .hint'), touch);
      await expect(ad).toHaveAttribute('data-kind', 'rewarded');
      await expect(ad).toHaveAttribute('data-rewarded', String(move));
      // Nothing behind the ad can be reached.
      await expect(page.locator('#app')).toHaveAttribute('inert', '');
      await press(ad.getByRole('button', { name: 'Watch to the end' }), touch);
      await expect(ad).toBeHidden();
      const hinted = page.locator('.arrow.hinted');
      await expect(hinted).toHaveCount(1);
      await tapArrow(page, touch, Number(await hinted.getAttribute('data-arrow')));
      await expect(play(page)).toHaveAttribute(
        'data-arrows-left',
        String(puzzle.arrows.length - move),
      );
    }

    // Won: the interstitial comes first, and the score only once it has closed.
    await expect(ad).toHaveAttribute('data-kind', 'interstitial');
    await expect(ad).toHaveAttribute('data-interstitials', '1');
    await expect(score).toBeHidden();
    await press(ad.getByRole('button', { name: 'Close ad' }), touch);
    await expect(score).toBeVisible();
    await expect(ad).toBeHidden();
    await expect(ad).toHaveAttribute('data-interstitials', '1');
    await expect(ad).toHaveAttribute('data-rewarded', String(puzzle.arrows.length));

    // The next board won without a hint: one more interstitial, no rewarded ad.
    await press(score.getByRole('button', { name: 'Next level' }), touch);
    await expect(page).toHaveURL(/\?level=2$/);
    await solveByTaps(page, touch, generateLevel(2).puzzle);
    await expect(ad).toHaveAttribute('data-kind', 'interstitial');
    await press(ad.getByRole('button', { name: 'Close ad' }), touch);
    await expect(score).toBeVisible();
    await expect(ad).toHaveAttribute('data-interstitials', '2');
    await expect(ad).toHaveAttribute('data-rewarded', String(puzzle.arrows.length));

    // A lost board shows no ad: its sheet offers Retry at once.
    await press(score.getByRole('button', { name: 'Next level' }), touch);
    await expect(page).toHaveURL(/\?level=3$/);
    await loseBoard(page, touch, generateLevel(3).puzzle);
    await expect(ad).toBeHidden();
    await expect(ad).toHaveAttribute('data-interstitials', '2');
  });

  test('closing the rewarded ad early gives no hint', async ({ page, touch }) => {
    const ad = page.locator('.test-ad');
    await page.goto('./?level=1');
    await press(page.locator('.toolbar .hint'), touch);
    await press(ad.getByRole('button', { name: 'Close without the reward' }), touch);
    await expect(ad).toBeHidden();
    await expect(page.locator('.arrow.hinted')).toHaveCount(0);
    await expect(page.locator('.toolbar .hint .tool-label')).toHaveText('Hint');
    await expect(page.locator('.play [aria-live]')).toHaveText(
      'No hint: the ad was closed before the end.',
    );
    // Asked again and watched: the hint shows; asked once more, it shows without an ad.
    await press(page.locator('.toolbar .hint'), touch);
    await press(ad.getByRole('button', { name: 'Watch to the end' }), touch);
    await expect(page.locator('.arrow.hinted')).toHaveCount(1);
    await press(page.locator('.toolbar .hint'), touch);
    await expect(ad).toBeHidden();
    await expect(ad).toHaveAttribute('data-rewarded', '2');
  });
});

test('the puzzle picker turns the test ads on and off', async ({ page, touch }) => {
  await page.goto('./dev.html');
  const toggle = page.getByLabel('Show test ads', { exact: false });
  await expect(toggle).not.toBeChecked();
  await press(toggle, touch);
  await expect(toggle).toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), ADS_KEY)).toBe('test');
  await page.goto('./?level=1');
  await press(page.locator('.toolbar .hint'), touch);
  await expect(page.locator('.test-ad')).toBeVisible();

  await page.goto('./dev.html');
  await expect(toggle).toBeChecked();
  await press(toggle, touch);
  expect(await page.evaluate((key) => localStorage.getItem(key), ADS_KEY)).toBeNull();
  await page.goto('./?level=1');
  await press(page.locator('.toolbar .hint'), touch);
  await expect(page.locator('.arrow.hinted')).toHaveCount(1);
  await expect(page.locator('.test-ad')).toHaveCount(0);
});
