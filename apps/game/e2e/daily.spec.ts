import { generateDaily } from '@arrows/engine';
import { bodies, expect, press, solveWithHints, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

// The calendar depends on today: pin the clock and the time zone. Only Date is
// fixed; timers and animations run as usual.
test.use({ timezoneId: 'Europe/Lisbon' });
const TODAY = new Date('2026-10-14T10:00:00+01:00');

async function storeDays(page: Page, days: readonly string[]): Promise<void> {
  const value = JSON.stringify({
    version: 1,
    days: Object.fromEntries(days.map((day) => [day, { bestMs: 61_000 }])),
  });
  await page.evaluate((json) => localStorage.setItem('arrows.daily', json), value);
}

const day = (page: Page, dateKey: string) => page.locator(`[data-day="${dateKey}"]`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
});

test('the calendar shows the stored results, after a reload too', async ({ page }) => {
  await page.goto('./?calendar');
  await expect(page.locator('.month-title h2')).toHaveText('October 2026');
  await expect(page.locator('.month-stars')).toHaveText('0 of 31 stars');
  await storeDays(page, ['2026-10-02', '2026-10-05', '2026-09-30']);
  await page.reload();
  await expect(page.locator('.month-stars')).toHaveText('2 of 31 stars');
  await expect(day(page, '2026-10-02')).toHaveAttribute('data-state', 'done');
  await expect(day(page, '2026-10-05')).toHaveAttribute('data-state', 'done');
  await expect(day(page, '2026-10-06')).toHaveAttribute('data-state', 'open');
  await expect(day(page, '2026-10-14')).toHaveAttribute('aria-current', 'date');
  await expect(page.locator('.trophy.missed .sr-only')).toHaveText(
    'September 2026: 1 of 30 days won',
  );
  await page.goto('./');
  await expect(page.locator('a.daily .sr-only')).toHaveText('2 of 31 stars this month');
});

test('a past day opens the same puzzle as on its own day', async ({ page, touch }) => {
  const { puzzle } = generateDaily('2026-10-02');
  // On the day itself.
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00+01:00'));
  await page.goto('./?daily=2026-10-02');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  const onTheDay = await bodies(page);

  // Twelve days later, from the calendar.
  await page.clock.setFixedTime(TODAY);
  await page.goto('./?calendar');
  await press(day(page, '2026-10-02'), touch);
  await expect(page).toHaveURL(/\?daily=2026-10-02$/);
  await expect(page.locator('h1')).toHaveText('Daily · Oct 2, 2026');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  expect(await bodies(page)).toEqual(onTheDay);
  // Its back button returns to its month.
  await press(page.getByRole('link', { name: 'Back to the calendar' }), touch);
  await expect(page).toHaveURL(/\?calendar=2026-10$/);
});

test('days ahead cannot be opened, from the calendar or by a link', async ({ page, touch }) => {
  await page.goto('./?calendar');
  const ahead = day(page, '2026-10-15');
  await expect(ahead).toHaveAttribute('data-state', 'locked');
  await expect(ahead).not.toHaveAttribute('href');
  await press(ahead, touch);
  await expect(page).toHaveURL(/\?calendar$/);
  await expect(page.locator('.play')).toHaveCount(0);

  await page.goto('./?daily=2026-10-20');
  await expect(page.locator('h1')).toHaveText('Daily challenge');
  await expect(page).toHaveURL(/\?calendar=2026-10$/);
  await expect(page.locator('.play')).toHaveCount(0);
  await page.goto('./?daily=2025-12-31');
  await expect(page).toHaveURL(/\?calendar=2026-01$/);
});

test('months move back and forth, and Play today opens today', async ({ page, touch }) => {
  await page.goto('./?calendar');
  const next = page.getByRole('button', { name: 'Next month' });
  const previous = page.getByRole('button', { name: 'Previous month' });
  await expect(next).toBeDisabled();
  await press(previous, touch);
  await expect(page.locator('.month-title h2')).toHaveText('September 2026');
  await expect(page).toHaveURL(/\?calendar=2026-09$/);
  await expect(page.locator('.month-days a[data-day]')).toHaveCount(30);
  await press(next, touch);
  await expect(page.locator('.month-title h2')).toHaveText('October 2026');

  await expect(page.locator('#today-board')).toHaveText('Weekday board · Medium · 16 × 24');
  await press(page.getByRole('link', { name: 'Play today' }), touch);
  await expect(page).toHaveURL(/\?daily=2026-10-14$/);
  await expect(page.locator('h1')).toHaveText('Daily · Oct 14, 2026');
});

test('winning a day earns its star, kept after a reload', async ({ page, touch }) => {
  // A daily board has many arrows; following every hint takes a while.
  test.slow();
  await page.goto('./?daily=2026-10-12');
  await solveWithHints(page, touch, generateDaily('2026-10-12').puzzle);
  const sheet = page.locator('.overlay[data-overlay="won"]');
  await expect(sheet).toContainText('A star for Mon 12 Oct.');
  await press(sheet.getByRole('link', { name: 'Calendar' }), touch);
  await expect(page).toHaveURL(/\?calendar=2026-10$/);
  await expect(day(page, '2026-10-12')).toHaveAttribute('data-state', 'done');
  await page.reload();
  await expect(day(page, '2026-10-12')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('.month-stars')).toHaveText('1 of 31 stars');
});
