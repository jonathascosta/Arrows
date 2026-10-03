import { describe, expect, it } from 'vitest';
import { boardBounds } from './geometry.ts';
import {
  cellAt,
  createViewport,
  ensureVisible,
  frameOf,
  isZoomed,
  panBy,
  pinchView,
  resetView,
  toBoard,
  toScreen,
  transformOf,
  zoomAt,
} from './viewport.ts';

/** A 10 by 20 board with no margin on a 400 by 600 stage: 30 px per cell... */
const bounds = boardBounds(10, 20, 0);

describe('createViewport', () => {
  it('fits the board and centres it on the short axis', () => {
    const view = createViewport(400, 600, bounds);
    expect(view.fitScale).toBe(30); // min(400 / 10, 600 / 20)
    expect(view.scale).toBe(30);
    expect(view.tx).toBe(50); // (400 - 300) / 2
    expect(view.ty).toBe(0);
    expect(isZoomed(view)).toBe(false);
  });

  it('caps zoom at the larger of 72 px per cell and twice the fit', () => {
    expect(createViewport(400, 600, bounds).maxScale).toBe(72);
    expect(createViewport(4000, 6000, bounds).maxScale).toBe(600);
  });

  it('fits inside the insets', () => {
    const view = createViewport(400, 700, bounds, {
      insets: { top: 0, right: 0, bottom: 100, left: 0 },
    });
    expect(frameOf(view)).toEqual({ x: 0, y: 0, width: 400, height: 600 });
    expect(view.fitScale).toBe(30);
    expect(view.ty).toBe(0);
  });

  it('survives a stage with no size yet', () => {
    const view = createViewport(0, 0, bounds);
    expect(Number.isFinite(view.scale)).toBe(true);
    expect(view.scale).toBeGreaterThan(0);
  });
});

describe('zoomAt', () => {
  it('keeps the board point under the cursor in place', () => {
    const view = createViewport(400, 600, bounds);
    const before = toBoard(view, 200, 300);
    const zoomed = zoomAt(view, 2, 200, 300);
    expect(zoomed.scale).toBe(60);
    const after = toBoard(zoomed, 200, 300);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(isZoomed(zoomed)).toBe(true);
  });

  it('never zooms out past the fit or in past the cap', () => {
    const view = createViewport(400, 600, bounds);
    expect(zoomAt(view, 0.1, 0, 0).scale).toBe(30);
    expect(zoomAt(view, 100, 0, 0).scale).toBe(72);
  });
});

describe('pinchView', () => {
  it('moves the board point under the old midpoint to the new one, at the new scale', () => {
    const view = zoomAt(createViewport(400, 600, bounds), 2, 200, 300);
    const anchor = toBoard(view, 200, 300);
    const next = pinchView(view, 1.1, 200, 300, 190, 310);
    expect(next.scale).toBeCloseTo(66);
    const now = toBoard(next, 190, 310);
    expect(now.x).toBeCloseTo(anchor.x);
    expect(now.y).toBeCloseTo(anchor.y);
  });

  it('keeps the pan when the board is pinned at the fit, unlike pan then zoom', () => {
    // At the fit the left edge is clamped; a pan alone would be undone.
    const view = createViewport(300, 600, bounds);
    expect(panBy(view, -10, 0)).toEqual(view);
    const next = pinchView(view, 1.5, 15, 15, 5, 15);
    const now = toBoard(next, 5, 15);
    expect(now.x).toBeCloseTo(0.5);
    expect(now.y).toBeCloseTo(0.5);
    // Two separate steps drift: the pan is clamped away before the zoom.
    const split = zoomAt(panBy(view, -10, 0), 1.5, 5, 15);
    expect(toBoard(split, 5, 15).x).not.toBeCloseTo(0.5);
  });
});

describe('panBy', () => {
  it('cannot move a fitted board', () => {
    const view = createViewport(400, 600, bounds);
    expect(panBy(view, 80, -80)).toEqual(view);
  });

  it('pans a zoomed board until its edge reaches the stage edge', () => {
    const zoomed = zoomAt(createViewport(400, 600, bounds), 2, 0, 0);
    expect(panBy(zoomed, 10_000, 10_000).tx).toBe(0);
    expect(panBy(zoomed, 10_000, 10_000).ty).toBe(0);
    // 10 cells * 60 px = 600 px wide, stage 400: the right edge stops at 400.
    expect(panBy(zoomed, -10_000, 0).tx).toBe(-200);
  });

  it('resets to the fit', () => {
    const zoomed = panBy(zoomAt(createViewport(400, 600, bounds), 2, 0, 0), -50, -50);
    expect(resetView(zoomed)).toEqual(createViewport(400, 600, bounds));
  });
});

describe('cells and visibility', () => {
  it('maps stage points to cells at any zoom', () => {
    const view = createViewport(400, 600, bounds);
    expect(cellAt(view, 50 + 15, 15)).toEqual({ x: 0, y: 0 });
    expect(cellAt(view, 50 + 30 * 9.5, 30 * 19.5)).toEqual({ x: 9, y: 19 });
    expect(cellAt(view, 10, 10).x).toBeLessThan(0);
    const zoomed = zoomAt(view, 2, 0, 0);
    const screen = toScreen(zoomed, { x: 3.5, y: 4.5 });
    expect(cellAt(zoomed, screen.x, screen.y)).toEqual({ x: 3, y: 4 });
  });

  it('pans just enough to show a point', () => {
    const zoomed = zoomAt(createViewport(400, 600, bounds), 2, 0, 0);
    const far = { x: 7.5, y: 15.5 };
    expect(toScreen(zoomed, far).y).toBeGreaterThan(600);
    const shown = ensureVisible(zoomed, far, 40);
    const screen = toScreen(shown, far);
    expect(screen.x).toBeLessThanOrEqual(400 - 40 + 1e-9);
    expect(screen.y).toBeLessThanOrEqual(600 - 40 + 1e-9);
    // Already visible: no change.
    expect(ensureVisible(shown, far, 40)).toEqual(shown);
  });

  it('writes an SVG transform', () => {
    expect(transformOf(createViewport(400, 600, bounds))).toBe('translate(50 0) scale(30)');
  });
});
