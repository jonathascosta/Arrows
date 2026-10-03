import { createGame, freeArrows, generateDaily, generateLevel } from '@arrows/engine';
import { expect, play, press, solveWithHints, tapArrow, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const PROGRESS_KEY = 'arrows.progress';

/** Loses the open level by tapping an arrow that is blocked at the start. */
async function loseLevel(page: Page, touch: boolean, level: number): Promise<void> {
  const { puzzle } = generateLevel(level);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  for (let i = 0; i < game.livesAtStart; i++) await tapArrow(page, touch, id);
  await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
}

/** Puts stored progress in place, as an earlier visit would have left it. */
async function storeProgress(
  page: Page,
  progress: { currentLevel: number; streak: number },
): Promise<void> {
  const value = JSON.stringify({
    version: 1,
    bestTimes: {},
    bestStreak: progress.streak,
    ...progress,
  });
  await page.evaluate(([key, json]) => localStorage.setItem(key!, json!), [PROGRESS_KEY, value]);
}

async function expectHome(page: Page, level: number, streak: number): Promise<void> {
  await expect(page.locator('.levels-card h2')).toHaveText(`Level ${level}`);
  await expect(page.locator('.streak')).toHaveAttribute('aria-label', `Win streak: ${streak}`);
  await expect(page.getByRole('link', { name: 'Play', exact: true })).toHaveAttribute(
    'href',
    `./?level=${level}`,
  );
}

test('a won level moves the path, and the path survives a reload', async ({ page, touch }) => {
  await page.goto('./');
  await expectHome(page, 1, 0);
  await expect(page.locator('.strip-item[data-state="current"]')).toHaveText('1');

  await press(page.getByRole('link', { name: 'Play', exact: true }), touch);
  await expect(page).toHaveURL(/\?level=1$/);
  await solveWithHints(page, touch, generateLevel(1).puzzle);
  const sheet = page.locator('.overlay[data-overlay="won"]');
  await expect(sheet).toContainText('First try. Win streak is now 1.');

  // The win is stored the moment the board is won: a reload now keeps it.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Level 1');
  await press(page.getByRole('link', { name: 'Back to home' }), touch);
  await expect(page).toHaveURL(/\/$/);
  await expectHome(page, 2, 1);
  await expect(page.locator('.strip-item[data-state="done"]')).toHaveText('1');

  await page.reload();
  await expectHome(page, 2, 1);
  const stored = await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY);
  const progress = JSON.parse(stored!) as { bestTimes: Record<string, number> };
  expect(progress).toMatchObject({ version: 1, currentLevel: 2, streak: 1 });
  expect(progress.bestTimes['1']).toBeGreaterThan(0);
});

test('a lost board ends the streak, and winning that level later does not count', async ({
  page,
  touch,
}) => {
  await page.goto('./');
  await storeProgress(page, { currentLevel: 3, streak: 2 });
  await page.reload();
  await expectHome(page, 3, 2);

  await press(page.getByRole('link', { name: 'Play', exact: true }), touch);
  await loseLevel(page, touch, 3);
  // Leaving after the loss, and coming back to the level, is no fresh first try.
  await press(page.locator('.overlay').getByRole('link', { name: 'Home' }), touch);
  await expectHome(page, 3, 0);

  await press(page.getByRole('link', { name: 'Play', exact: true }), touch);
  await solveWithHints(page, touch, generateLevel(3).puzzle);
  await expect(page.locator('.overlay[data-overlay="won"]')).toContainText(
    'Not on the first try, so the streak starts again.',
  );
  await press(page.getByRole('button', { name: 'Next level' }), touch);
  await expect(page).toHaveURL(/\?level=4$/);
  await solveWithHints(page, touch, generateLevel(4).puzzle);
  await expect(page.locator('.overlay[data-overlay="won"]')).toContainText(
    'First try. Win streak is now 1.',
  );
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Level 3');
  await page.goto('./');
  await expectHome(page, 5, 1);
});

test('the home cards open the daily and the event board', async ({ page, touch }) => {
  await page.goto('./');
  await press(page.locator('a.daily'), touch);
  await expect(page).toHaveURL(/\?daily=\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator('h1')).toContainText('Daily · ');
  await expect(play(page)).toBeVisible();

  await page.goto('./');
  await expect(page.locator('.league')).toHaveAttribute('aria-disabled', 'true');
  await press(page.locator('a.event-card'), touch);
  await expect(page).toHaveURL(/\?drawing=butterfly&tier=hard$/);
  await expect(page.locator('h1')).toHaveText('Butterfly');
});

test('a lost daily leaves the streak alone', async ({ page, touch }) => {
  await page.goto('./');
  await storeProgress(page, { currentLevel: 3, streak: 2 });
  await page.goto('./?daily=2026-10-03');
  const { puzzle } = generateDaily('2026-10-03');
  const free = new Set(freeArrows(createGame(puzzle)));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  for (let i = 0; i < 3; i++) await tapArrow(page, touch, id);
  await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
  await press(page.locator('.overlay').getByRole('link', { name: 'Home' }), touch);
  await expectHome(page, 3, 2);
});
