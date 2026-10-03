import { describe, expect, it } from 'vitest';
import { boardBounds } from './geometry.ts';
import type { GestureAction } from './gestures.ts';
import { GestureTracker } from './gestures.ts';
import { createViewport, panBy, pinchView, toBoard } from './viewport.ts';
import type { Viewport } from './viewport.ts';

/** Applies actions the way the play screen does: pinches from the view at the pinch start. */
class ViewDriver {
  private base: Viewport | null = null;
  view: Viewport;
  constructor(view: Viewport) {
    this.view = view;
  }
  apply(actions: readonly GestureAction[]): void {
    for (const action of actions) {
      if (action.kind === 'pan') this.view = panBy(this.view, action.dx, action.dy);
      if (action.kind === 'pinchEnd') this.base = null;
      if (action.kind === 'pinch') {
        this.base ??= this.view;
        this.view = pinchView(
          this.base,
          action.factor,
          action.fromX,
          action.fromY,
          action.x,
          action.y,
        );
      }
    }
  }
}

/** Two fingers around `mid` spreading from `from` to `to`, moving one at a time as browsers report them. */
function spread(
  g: GestureTracker,
  driver: ViewDriver,
  mid: { x: number; y: number },
  from: number,
  to: number,
): void {
  driver.apply(g.down(1, mid.x - from, mid.y - from, 0));
  driver.apply(g.down(2, mid.x + from, mid.y + from, 0));
  for (let d = from + 5; d <= to; d += 5) {
    driver.apply(g.move(2, mid.x + d, mid.y + d));
    driver.apply(g.move(1, mid.x - d, mid.y - d));
  }
  driver.apply(g.up(1, 100));
  driver.apply(g.up(2, 100));
}

describe('GestureTracker', () => {
  it('turns a short press into a tap at the press position', () => {
    const g = new GestureTracker();
    expect(g.down(1, 100, 100, 0)).toEqual([]);
    expect(g.move(1, 103, 102)).toEqual([]);
    expect(g.up(1, 120)).toEqual([{ kind: 'tap', x: 100, y: 100, double: false }]);
    expect(g.activePointers).toBe(0);
  });

  it('turns a press held too long into nothing', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(1, 900)).toEqual([]);
  });

  it('pans past the slop, catching up in one step, and then does not tap', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.move(1, 110, 100)).toEqual([{ kind: 'pan', dx: 10, dy: 0 }]);
    expect(g.move(1, 115, 90)).toEqual([{ kind: 'pan', dx: 5, dy: -10 }]);
    expect(g.up(1, 100)).toEqual([]);
  });

  it('pinches from where the pinch started, and ends it when a finger lifts', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.down(2, 200, 100, 10)).toEqual([]);
    expect(g.move(2, 300, 100)).toEqual([
      { kind: 'pinch', factor: 2, fromX: 150, fromY: 100, x: 200, y: 100 },
    ]);
    // Measured from the start, not from the previous step.
    expect(g.move(1, 0, 100)).toEqual([
      { kind: 'pinch', factor: 3, fromX: 150, fromY: 100, x: 150, y: 100 },
    ]);
    expect(g.up(2, 50)).toEqual([{ kind: 'pinchEnd' }]);
    // The finger left behind pans, and lifting it is not a tap.
    expect(g.move(1, 10, 100)).toEqual([{ kind: 'pan', dx: 10, dy: 0 }]);
    expect(g.up(1, 60)).toEqual([]);
  });

  it('restarts the pinch when a third finger joins or one of three leaves', () => {
    const g = new GestureTracker();
    g.down(1, 0, 0, 0);
    g.down(2, 100, 0, 0);
    g.move(2, 200, 0);
    expect(g.down(3, 50, 50, 0)).toEqual([{ kind: 'pinchEnd' }]);
    expect(g.move(2, 200, 0)).toEqual([
      { kind: 'pinch', factor: 1, fromX: 100, fromY: 0, x: 100, y: 0 },
    ]);
    // Finger 1 is cancelled: fingers 2 and 3 carry on as a new pinch.
    expect(g.cancel(1)).toEqual([{ kind: 'pinchEnd' }]);
    const [action] = g.move(3, 50, 150);
    expect(action).toMatchObject({ kind: 'pinch', fromX: 125, fromY: 25, x: 125, y: 75 });
    expect(g.cancel(9)).toEqual([]);
  });

  it('flags a second tap close in time and space as double, once', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(1, 50)).toEqual([{ kind: 'tap', x: 100, y: 100, double: false }]);
    g.down(1, 110, 105, 200);
    expect(g.up(1, 250)).toEqual([{ kind: 'tap', x: 110, y: 105, double: true }]);
    g.down(1, 110, 105, 400);
    expect(g.up(1, 450)).toEqual([{ kind: 'tap', x: 110, y: 105, double: false }]);
  });

  it('does not call taps far apart or slow double', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    g.up(1, 50);
    g.down(1, 300, 100, 100);
    expect(g.up(1, 150)).toEqual([{ kind: 'tap', x: 300, y: 100, double: false }]);
    g.down(1, 300, 100, 1000);
    expect(g.up(1, 1050)).toEqual([{ kind: 'tap', x: 300, y: 100, double: false }]);
  });

  it('ignores moves and ups of unknown pointers, and forgets cancelled ones', () => {
    const g = new GestureTracker();
    expect(g.move(7, 1, 1)).toEqual([]);
    expect(g.up(7, 0)).toEqual([]);
    g.down(1, 0, 0, 0);
    expect(g.cancel(1)).toEqual([]);
    expect(g.up(1, 10)).toEqual([]);
    expect(g.activePointers).toBe(0);
  });
});

describe('pinching a viewport', () => {
  it('keeps the board point under the fingers under them', () => {
    const fitted = createViewport(400, 600, boardBounds(10, 20, 0), { maxCellPixels: 400 });
    const driver = new ViewDriver(fitted);
    const mid = { x: 200, y: 300 };
    const under = toBoard(fitted, mid.x, mid.y);
    spread(new GestureTracker(), driver, mid, 20, 60);
    expect(driver.view.scale).toBeCloseTo(fitted.scale * 3);
    const now = toBoard(driver.view, mid.x, mid.y);
    expect(now.x).toBeCloseTo(under.x, 6);
    expect(now.y).toBeCloseTo(under.y, 6);
  });

  it('keeps what the fingers started on near them even when an edge pins the board', () => {
    // A board with slack above and below at the fit: its top edge pins as soon as it grows.
    const fitted = createViewport(400, 900, boardBounds(10, 20, 0.6), { maxCellPixels: 400 });
    const mid = { x: 60, y: fitted.ty + 0.6 * fitted.scale + 8 };
    const under = toBoard(fitted, mid.x, mid.y);
    const driver = new ViewDriver(fitted);
    spread(new GestureTracker(), driver, mid, 10, 60);
    expect(driver.view.scale).toBeGreaterThan(fitted.scale * 5);
    const now = toBoard(driver.view, mid.x, mid.y);
    expect(Math.abs(now.x - under.x)).toBeLessThan(0.05);
    expect(Math.abs(now.y - under.y)).toBeLessThan(0.05);
  });
});
