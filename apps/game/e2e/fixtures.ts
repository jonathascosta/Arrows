import type { Puzzle } from '@arrows/engine';
import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Every test fails on an uncaught error or a console error in the page. */
export const test = base.extend<{ touch: boolean }>({
  touch: async ({ hasTouch }, use) => {
    await use(hasTouch);
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});

export { expect };

/** A tap with a finger on touch devices, a click otherwise. */
export async function press(locator: Locator, touch: boolean): Promise<void> {
  if (touch) await locator.tap();
  else await locator.click();
}

/** Taps the screen at a point, the way a player would, not through the element. */
export async function tapAt(page: Page, touch: boolean, x: number, y: number): Promise<void> {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Taps the arrowhead of an arrow, wherever it is drawn at the current zoom. */
export async function tapArrow(page: Page, touch: boolean, id: number): Promise<void> {
  const box = await page.locator(`[data-arrow="${id}"] .head`).boundingBox();
  if (box === null) throw new Error(`Arrow ${id} is not on screen`);
  await tapAt(page, touch, box.x + box.width / 2, box.y + box.height / 2);
}

export function play(page: Page): Locator {
  return page.locator('.play');
}

export async function bodies(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-arrow] .body')
    .evaluateAll((paths) => paths.map((p) => p.getAttribute('d')));
}

/** Wins the open board by asking for a hint and tapping the hinted arrow, arrow after arrow. */
export async function solveWithHints(page: Page, touch: boolean, puzzle: Puzzle): Promise<void> {
  for (let move = 0; move < puzzle.arrows.length; move++) {
    await press(page.locator('.toolbar .hint'), touch);
    const hinted = page.locator('.arrow.hinted');
    await expect(hinted).toHaveCount(1);
    const id = Number(await hinted.getAttribute('data-arrow'));
    await tapArrow(page, touch, id);
    await expect(play(page)).toHaveAttribute(
      'data-arrows-left',
      String(puzzle.arrows.length - move - 1),
    );
  }
}
