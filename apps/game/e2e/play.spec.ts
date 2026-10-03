import { createGame, freeArrows, generateLevel, tap } from '@arrows/engine';
import { bodies, expect, play, press, solveWithHints, tapArrow, test } from './fixtures.ts';

// The engine is the oracle: the page generates the same puzzle from the same seed.

test('level 1 is won by following the hints, then opens level 2', async ({ page, touch }) => {
  const { puzzle } = generateLevel(1);
  await page.goto('./?level=1');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  await expect(page.locator('.time')).toHaveText('00:00');

  await solveWithHints(page, touch, puzzle);

  const overlay = page.locator('.overlay[data-overlay="won"]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('3 of 3 chances left');
  await expect(page.locator('.chances')).toHaveAttribute('data-chances', '3');
  await press(overlay.getByRole('button', { name: 'Next level' }), touch);
  await expect(page).toHaveURL(/\?level=2$/);
  await expect(page.locator('h1')).toHaveText('Level 2');
  await expect(page.locator('[data-arrow]')).toHaveCount(generateLevel(2).puzzle.arrows.length);
});

test('a blocked tap costs a chance; three lose; retry brings back the whole board', async ({
  page,
  touch,
}) => {
  const { puzzle } = generateLevel(1);
  await page.goto('./?level=1');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  const initial = await bodies(page);

  // Clear two arrows first, so a retry that does not rebuild the board fails.
  let game = createGame(puzzle);
  for (let move = 0; move < 2; move++) {
    const id = freeArrows(game)[0]!;
    await tapArrow(page, touch, id);
    game = tap(game, id).state;
    await expect(play(page)).toHaveAttribute(
      'data-arrows-left',
      String(puzzle.arrows.length - move - 1),
    );
  }
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length - 2);

  const free = new Set(freeArrows(game));
  const id = [...game.remaining].find((arrow) => !free.has(arrow))!;
  await tapArrow(page, touch, id);
  await expect(page.locator('.chances')).toHaveAttribute('data-chances', '2');
  await expect(page.locator('.chance.lost')).toHaveCount(1);
  await expect(page.locator(`[data-arrow="${id}"]`)).toBeAttached();
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length - 2));

  await tapArrow(page, touch, id);
  await tapArrow(page, touch, id);
  const overlay = page.locator('.overlay[data-overlay="lost"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('heading')).toHaveText('Out of chances');
  await expect(play(page)).toHaveAttribute('data-status', 'lost');
  await expect(page.locator('.chance.lost')).toHaveCount(3);
  await expect(overlay.getByRole('link', { name: 'Home' })).toHaveAttribute('href', './');

  await press(overlay.getByRole('button', { name: 'Retry' }), touch);
  await expect(overlay).toBeHidden();
  await expect(page.locator('.chances')).toHaveAttribute('data-chances', '3');
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length));
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  expect(await bodies(page)).toEqual(initial);
  await expect(page.locator('.time')).toHaveText('00:00');
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
  // One fixed label; aria-pressed carries the state.
  const toggle = page.getByRole('button', { name: 'Grid', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await press(toggle, touch);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.grid')).toHaveAttribute('visibility', 'visible');
  await press(page.locator('.toolbar .hint'), touch);
  await expect(page.locator('.arrow.hinted')).toHaveCount(1);
});

test('the losing tap flashes red, and the board fades only under the sheet', async ({
  page,
  touch,
}) => {
  // Without transitions the computed colours are final at once. The page clock
  // is frozen, so the 280 ms flash cannot run out while the test reads it,
  // however slow the machine; time moves only when the test says so.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Both ends pinned: the test does not depend on today's date.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  const { puzzle } = generateLevel(1);
  const free = new Set(freeArrows(createGame(puzzle)));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  await page.goto('./?level=1');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  const colorOf = (selector: string) =>
    page.locator(selector).evaluate((element) => getComputedStyle(element).color);
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      blocked: style.getPropertyValue('--color-blocked').trim(),
      lost: style.getPropertyValue('--color-chance-lost').trim(),
    };
  });
  const rgb = (hex: string) =>
    `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

  await tapArrow(page, touch, id);
  await page.clock.runFor(1000);
  await tapArrow(page, touch, id);
  await page.clock.runFor(1000);
  await expect(page.locator('.chances')).toHaveAttribute('data-chances', '1');

  await tapArrow(page, touch, id);
  // Time is frozen: the flash is on, and the sheet has not opened yet.
  expect(await colorOf(`[data-arrow="${id}"]`)).toBe(rgb(tokens.blocked));
  await expect(play(page)).toHaveAttribute('data-status', 'lost');
  await expect(play(page)).not.toHaveAttribute('data-faded');
  await expect(page.locator('.overlay[data-overlay="lost"]')).toBeHidden();

  await page.clock.runFor(1000);
  await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
  await expect(play(page)).toHaveAttribute('data-faded', 'true');
  expect(await colorOf(`[data-arrow="${id}"]`)).toBe(rgb(tokens.lost));
});
