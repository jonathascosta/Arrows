import { generateLevel } from '@arrows/engine';
import { expectHome, press, solveWithHints, storeProgress, test } from './fixtures.ts';
import { expect } from '@playwright/test';

// Playwright turns the back-forward cache off; players' browsers keep it on. The headless
// shell Playwright runs by default has no such cache at all, so where no browser is given (CI)
// this spec runs the full Chromium build, which `playwright install chromium` also installs.
const withCache = test.extend({
  launchOptions: [
    async ({ launchOptions }, use) => {
      await use({
        ...launchOptions,
        ...(launchOptions.executablePath === undefined ? { channel: 'chromium' } : {}),
        ignoreDefaultArgs: ['--disable-back-forward-cache'],
      });
    },
    { scope: 'worker' },
  ],
});

withCache(
  'the home screen restored by the browser’s Back button shows the new progress',
  async ({ page, touch }) => {
    await page.goto('./');
    await expectHome(page, 1, 0);
    // Marks this document: it survives only if the browser restores the page from its cache.
    await page.evaluate(() => {
      (window as unknown as { kept: boolean }).kept = true;
    });
    await press(page.getByRole('link', { name: 'Play', exact: true }), touch);
    await solveWithHints(page, touch, generateLevel(1).puzzle);
    await expect(page.locator('.overlay[data-overlay="won"]')).toBeVisible();

    // A page restored from the cache fires pageshow but not load.
    await page.goBack({ waitUntil: 'commit' });
    const restored = await page.evaluate(() => (window as unknown as { kept?: boolean }).kept);
    expect(restored, 'the page came back from the back-forward cache').toBe(true);
    await expectHome(page, 2, 1);
  },
);

// Chromium also hands a restored page the storage events it missed, so the test above passes
// with either listener; this one holds the pageshow listener on its own, for browsers that do not.
test('a home page shown again from the cache reads the stored progress', async ({ page }) => {
  await page.goto('./');
  await expectHome(page, 1, 0);
  await storeProgress(page, { currentLevel: 7, streak: 4 });
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expectHome(page, 7, 4);
});

test('progress saved in another tab shows on this home screen', async ({ page, context }) => {
  await page.goto('./');
  await expectHome(page, 1, 0);
  const other = await context.newPage();
  await other.goto('./');
  await storeProgress(other, { currentLevel: 9, streak: 3 });
  await expectHome(page, 9, 3);
  await other.close();
});

test('the calendar reads stored results again when shown from the cache or another tab', async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
  await page.goto('./?calendar');
  await expect(page.locator('.month-stars')).toHaveText('0 of 31 stars');
  const store = (target: typeof page, days: string[]) =>
    target.evaluate(
      (json) => localStorage.setItem('arrows.daily', json),
      JSON.stringify({
        version: 1,
        days: Object.fromEntries(days.map((day) => [day, { bestMs: 1000 }])),
      }),
    );

  // Restored from the back-forward cache (the listener alone, as above).
  await store(page, ['2026-10-02']);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('.month-stars')).toHaveText('1 of 31 stars');

  // Saved from another tab: the storage event.
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
  await other.goto('./?calendar');
  await store(other, ['2026-10-02', '2026-10-05']);
  await expect(page.locator('.month-stars')).toHaveText('2 of 31 stars');
  await expect(page.locator('[data-day="2026-10-05"]')).toHaveAttribute('data-state', 'done');
  await other.close();
});
