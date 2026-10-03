import { createGame, freeArrows, generateLevel } from '@arrows/engine';
import type { Page } from '@playwright/test';
import { expect, play, press, tapArrow, test } from './fixtures.ts';

const zoomOf = async (page: Page): Promise<number> =>
  Number(await play(page).getAttribute('data-zoom'));

test('two fingers pinch to zoom and taps still land on the right arrow', async ({
  page,
  touch,
}) => {
  test.skip(!touch, 'touch only');
  const { puzzle } = generateLevel(300);
  await page.goto('./?level=300');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  expect(await zoomOf(page)).toBe(1);

  // Pinch around a free arrow: zooming keeps the point between the fingers in place.
  const target = freeArrows(createGame(puzzle))[0]!;
  const head = (await page.locator(`[data-arrow="${target}"] .head`).boundingBox())!;
  const cx = head.x + head.width / 2;
  const cy = head.y + head.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const fingers = (spread: number) => [
    { x: cx - spread, y: cy - spread, id: 0 },
    { x: cx + spread, y: cy + spread, id: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(20) });
  for (let spread = 30; spread <= 80; spread += 10) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(2);
  // Pinching is not a tap.
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length));

  await tapArrow(page, touch, target);
  await expect(page.locator(`[data-arrow="${target}"]`)).toHaveAttribute('data-state', 'leaving');
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '3');
});

test('the wheel zooms at the pointer, drag pans, double click on empty space resets', async ({
  page,
  touch,
}) => {
  test.skip(touch, 'mouse only');
  const { puzzle } = generateLevel(300);
  await page.goto('./?level=300');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  const box = (await page.locator('.stage').boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -600);
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1.5);

  const transform = () => page.locator('.board-content').getAttribute('transform');
  const before = await transform();
  await page.mouse.down();
  await page.mouse.move(centre.x + 80, centre.y + 60, { steps: 5 });
  await page.mouse.up();
  expect(await transform()).not.toBe(before);
  // Dragging never removes an arrow.
  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length));

  await page.keyboard.press('0');
  await expect.poll(() => zoomOf(page)).toBe(1);

  // Zoomed in around the centre, the stage's top-left corner is still outside the board.
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1);
  await page.mouse.dblclick(box.x + 4, box.y + 4);
  await expect.poll(() => zoomOf(page)).toBe(1);
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '3');
});

test('a quick double tap on an arrow plays it and keeps the zoom', async ({ page, touch }) => {
  const { puzzle } = generateLevel(300);
  await page.goto('./?level=300');
  await expect(page.locator('[data-arrow]')).toHaveCount(puzzle.arrows.length);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1.5);
  const zoom = await zoomOf(page);

  await press(page.locator('.hud .hint'), touch);
  const id = Number(await page.locator('.arrow.hinted').getAttribute('data-arrow'));
  const box = (await page.locator(`[data-arrow="${id}"] .head`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.dblclick(x, y);
  }

  await expect(play(page)).toHaveAttribute('data-arrows-left', String(puzzle.arrows.length - 1));
  await expect(page.locator('.drops')).toHaveAttribute('data-lives', '3');
  expect(await zoomOf(page)).toBe(zoom);
});
