import { findDrawing } from '@arrows/engine';
import { DEFAULT_THEME } from '../src/theme/default.ts';
import { expect, play, press, solveWithHints, test } from './fixtures.ts';
import { loadPuzzle } from '../src/puzzles.ts';
import type { Page } from '@playwright/test';

// The event runs from 1 October to 30 November 2026: pin the day inside it.
test.use({ timezoneId: 'Europe/Lisbon' });
const DURING = new Date('2026-10-14T12:00:00+01:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(DURING);
});

async function storeWon(page: Page, boards: number[]): Promise<void> {
  await page.evaluate(
    (json) => localStorage.setItem('arrows.events', json),
    JSON.stringify({ version: 1, events: { 'autumn-2026': boards } }),
  );
}

const rgb = (hex: string): string =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test('the event card opens the first board, drawn in the drawing’s colours', async ({
  page,
  touch,
}) => {
  await page.goto('./');
  const card = page.locator('a.event-card');
  await expect(card.locator('.card-label')).toHaveText('Autumn event');
  await expect(card.locator('.card-title')).toHaveText('Maple Leaf');
  await expect(card.locator('.card-note')).toHaveText('0 of 6 boards · 48 days left');
  await press(card, touch);
  await expect(page).toHaveURL(/\?event=autumn-2026&board=1$/);
  await expect(page.locator('h1')).toHaveText('Maple Leaf');
  await expect(page.locator('.tier')).toHaveText('Autumn · 1 of 6');

  const { puzzle } = loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 1 });
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  // Every arrow is drawn in the colour of its cells in the drawing.
  const drawing = findDrawing('maple-leaf')!;
  const drawn = await page
    .locator('[data-arrow] .body')
    .evaluateAll((bodies) =>
      bodies.map((body) => [
        Number(body.closest('[data-arrow]')!.getAttribute('data-arrow')),
        getComputedStyle(body).stroke,
      ]),
    );
  for (const [id, stroke] of drawn as [number, string][]) {
    const cell = puzzle.arrows[id]!.cells[0]!;
    const name = drawing.legend[drawing.rows[cell.y]!.charAt(cell.x)]!;
    expect(stroke, `arrow ${id}`).toBe(rgb(DEFAULT_THEME.drawingPalette[name]!));
  }
});

test('a board won counts, opens the next, and the progress survives a reload', async ({
  page,
  touch,
}) => {
  await page.goto('./?event=autumn-2026&board=1');
  await solveWithHints(
    page,
    touch,
    loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 1 }).puzzle,
  );
  const sheet = page.locator('.overlay[data-overlay="won"]');
  await expect(sheet).toContainText('Board 1 of 6 done.');
  await press(sheet.getByRole('button', { name: 'Next board' }), touch);
  await expect(page).toHaveURL(/\?event=autumn-2026&board=2$/);
  await expect(page.locator('h1')).toHaveText('Acorn');
  await expect(page.locator('.tier')).toHaveText('Autumn · 2 of 6');

  await page.goto('./');
  await page.reload();
  const card = page.locator('a.event-card');
  await expect(card).toHaveAttribute('href', './?event=autumn-2026&board=2');
  await expect(card.locator('.card-note')).toHaveText('1 of 6 boards · 48 days left');
  await expect(card.locator('.event-progress [data-done]')).toHaveCount(1);
  // A board further on opens the next one instead.
  await page.goto('./?event=autumn-2026&board=5');
  await expect(page).toHaveURL(/\?event=autumn-2026&board=2$/);
  await expect(play(page)).toBeVisible();
});

test('the last board earns the badge', async ({ page, touch }) => {
  test.slow();
  await page.goto('./');
  await storeWon(page, [1, 2, 3, 4, 5]);
  await page.goto('./?event=autumn-2026&board=6');
  await solveWithHints(
    page,
    touch,
    loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 6 }).puzzle,
  );
  await expect(page.locator('.overlay[data-overlay="won"]')).toContainText(
    'Every board won: the Autumn 2026 badge is yours!',
  );
  await page.goto('./');
  const card = page.locator('.event-card');
  await expect(card.locator('.badge-earned')).toHaveText('Badge earned');
  await expect(page.locator('a.event-card')).toHaveCount(0);
  await expect(card.locator('.card-note')).toHaveText('6 of 6 boards · 48 days left');
});

test('after the last day the boards close and the card says how far you got', async ({ page }) => {
  await page.goto('./');
  await storeWon(page, [1, 2]);
  await page.clock.setFixedTime(new Date('2026-12-05T12:00:00Z'));
  await page.goto('./?event=autumn-2026&board=3');
  await expect(page.locator('.home')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  const card = page.locator('.event-card');
  await expect(card).toHaveAttribute('data-state', 'ended');
  await expect(card.locator('.card-note')).toHaveText('2 of 6 boards · Ended Mon 30 Nov');
  await expect(page.locator('a.event-card')).toHaveCount(0);
});

test.describe('on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('a board’s title and its place in the event read in full', async ({ page }) => {
    await page.goto('./?event=autumn-2026&board=1');
    await expect(page.locator('.tier')).toHaveText('Autumn · 1 of 6');
    for (const selector of ['.topbar h1', '.topbar .tier']) {
      const cut = await page
        .locator(selector)
        .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(cut, selector).toBe(false);
    }
    // The chances and the timer are still there, on a row of their own.
    await expect(page.locator('.chances')).toBeVisible();
    await expect(page.locator('.time')).toBeVisible();
  });
});
