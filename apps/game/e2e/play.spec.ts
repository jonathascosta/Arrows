import { createGame, freeArrows, generateLevel } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
import { bodies, expect, play, press, tapArrow, test } from './fixtures.ts';

/** The engine is the oracle: the page generates the same puzzle from the same seed. */
function blockedArrow(puzzle: Puzzle): number {
  const free = new Set(freeArrows(createGame(puzzle)));
  return puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
}

test('level 1 is won by following the hints, then opens level 2', async ({ page, touch }) => {
  const { puzzle } = generateLevel(1);
  await page.goto('./?level=1');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  await expect(page.locator('.time')).toHaveText('00:00');

  for (let move = 0; move < puzzle.arrows.length; move++) {
    await press(page.locator('.hud .hint'), touch);
    const hinted = page.locator('.arrow.hinted');
    await expect(hinted).toHaveCount(1);
    const id = Number(await hinted.getAttribute('data-arrow'));
    await tapArrow(page, touch, id);
    await expect(play(page)).toHaveAttribute(
      'data-arrows-left',
      String(puzzle.arrows.length - move - 1),
    );
  }

  const overlay = page.locator('.overlay[data-overlay="won"]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('3 of 3 drops left');
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '3');
  await press(overlay.getByRole('button', { name: 'Next level' }), touch);
  await expect(page).toHaveURL(/\?level=2$/);
  await expect(page.locator('h1')).toHaveText('Level 2');
  await expect(page.locator('[data-arrow]')).toHaveCount(generateLevel(2).puzzle.arrows.length);
});

test('a blocked tap costs a drop; three lose; retry brings back the same arrows', async ({
  page,
  touch,
}) => {
  const { puzzle } = generateLevel(1);
  const id = blockedArrow(puzzle);
  await page.goto('./?level=1');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  const initial = await bodies(page);

  await tapArrow(page, touch, id);
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '2');
  await expect(page.locator('.drop.lost')).toHaveCount(1);
  await expect(page.locator(`[data-arrow="${id}"]`)).toBeAttached();
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length));

  await tapArrow(page, touch, id);
  await tapArrow(page, touch, id);
  const overlay = page.locator('.overlay[data-overlay="lost"]');
  await expect(overlay).toBeVisible();
  await expect(play(page)).toHaveAttribute('data-status', 'lost');

  await press(overlay.getByRole('button', { name: 'Retry' }), touch);
  await expect(overlay).toBeHidden();
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '3');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  expect(await bodies(page)).toEqual(initial);
  await expect(page).toHaveURL(/\?level=1$/);
});

test('level 300 renders quickly and answers taps at once', async ({ page, touch }) => {
  const { puzzle } = generateLevel(300);
  await page.goto('./?level=300');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  await expect(page.locator('.tier')).toHaveText('Super Hard');

  const readyMs = await page.evaluate(
    () => performance.getEntriesByName('arrows:board-ready')[0]?.startTime ?? Number.NaN,
  );
  expect(readyMs).toBeLessThan(2500);

  // Long tasks while the board is up and being played.
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] };
    w.longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.longTasks.push(entry.duration);
    }).observe({ type: 'longtask' });
  });

  let game = createGame(puzzle);
  for (let move = 0; move < 5; move++) {
    const id = freeArrows(game)[0]!;
    const started = Date.now();
    await tapArrow(page, touch, id);
    await expect(page.locator(`[data-arrow="${id}"]`)).toHaveAttribute('data-state', 'leaving', {
      timeout: 1000,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    // Mirror the move in the oracle.
    const { tap } = await import('@arrows/engine');
    game = tap(game, id).state;
  }
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length - 5));
  const longTasks = await page.evaluate(
    () => (window as unknown as { longTasks: number[] }).longTasks,
  );
  expect(longTasks.filter((ms) => ms > 100)).toEqual([]);
});

test('the grid toggles and the hint button lights one arrow', async ({ page, touch }) => {
  await page.goto('./?level=13');
  const toggle = page.getByRole('button', { name: 'Show grid' });
  await press(toggle, touch);
  await expect(page.getByRole('button', { name: 'Hide grid' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.grid')).toHaveAttribute('visibility', 'visible');
  await press(page.locator('.hud .hint'), touch);
  await expect(page.locator('.arrow.hinted')).toHaveCount(1);
});
