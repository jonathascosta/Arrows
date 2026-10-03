import { createGame, freeArrows, generateLevel } from '@arrows/engine';
import type { Locator, Page } from '@playwright/test';
import { expect, tapArrow, test } from './fixtures.ts';

/** The rendered font size of an element, in pixels. */
async function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
}

/** As the iOS app would set it from the phone's text size (platform/textSize.ts). */
async function setTextScale(page: Page, scale: number): Promise<void> {
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--text-scale', String(value));
  }, scale);
}

test('the phone’s text size scales the text screens, not the board', async ({ page, touch }) => {
  await page.goto('./');
  const title = page.locator('.levels-card h2');
  const normal = await fontSize(title);
  await setTextScale(page, 1.5);
  expect(await fontSize(title)).toBeCloseTo(normal * 1.5, 0);

  await page.goto('./?level=1');
  await setTextScale(page, 1.5);
  const heading = page.locator('.topbar h1');
  const board = await fontSize(heading);
  await setTextScale(page, 1);
  expect(await fontSize(heading)).toBeCloseTo(board, 1);

  // Under the lost sheet, the sheet's text follows the setting again.
  await setTextScale(page, 1.5);
  const { puzzle } = generateLevel(1);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  for (let i = 0; i < game.livesAtStart; i++) await tapArrow(page, touch, id);
  const sheet = page.locator('.overlay[data-overlay="lost"] .sheet p');
  await expect(sheet).toBeVisible();
  const scaled = await fontSize(sheet);
  await setTextScale(page, 1);
  expect(scaled / (await fontSize(sheet))).toBeCloseTo(1.5, 1);
});
