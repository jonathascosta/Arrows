import { expect, press, test } from './fixtures.ts';

test('the dev page opens any level, day or drawing by its seed', async ({ page, touch }) => {
  await page.goto('./dev.html');
  await page.getByLabel('Level number').fill('300');
  await expect(page.getByText('Super Hard, 20 × 29')).toBeVisible();
  await press(page.locator('[data-open="level"]'), touch);
  await expect(page).toHaveURL(/\?level=300$/);
  await expect(page.locator('h1')).toHaveText('Level 300');

  await page.goto('./dev.html');
  await page.getByLabel('Date').fill('2026-10-03');
  await press(page.locator('[data-open="daily"]'), touch);
  await expect(page.locator('h1')).toHaveText('Daily · Oct 3, 2026');

  await page.goto('./dev.html');
  await page.getByLabel('Drawing').selectOption('butterfly');
  await page.getByLabel('Tier').selectOption('hard');
  await press(page.locator('[data-open="drawing"]'), touch);
  await expect(page.locator('h1')).toHaveText('Butterfly');
  await expect(page.locator('.tier')).toHaveText('Hard');

  await page.goto('./dev.html');
  await press(page.getByRole('button', { name: 'Preview' }).first(), touch);
  await expect(page.locator('.dev-preview dl')).toContainText('Free over remaining');
  await expect(page.locator('.dev-preview .ascii')).not.toBeEmpty();
});

test('the back button leads to the puzzle picker', async ({ page, touch }) => {
  await page.goto('./?level=5');
  await press(page.getByRole('link', { name: 'Back to puzzles' }), touch);
  await expect(page).toHaveURL(/dev\.html$/);
});
