import { maskFromAscii, rectangleMask } from '@arrows/engine';
import type { Arrow } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../theme/default.ts';
import {
  bodyPoints,
  boardBounds,
  exitDuration,
  exitTrack,
  gridData,
  headPoints,
  pathData,
  polygonData,
  polylineLength,
  simplify,
} from './geometry.ts';

const style = DEFAULT_THEME.board;
const motion = DEFAULT_THEME.motion;

/** An L: (0,0) → (1,0) → (1,1), head pointing down. */
const ell: Arrow = {
  id: 0,
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
  direction: 'down',
  color: 0,
};

const single: Arrow = { id: 1, cells: [{ x: 3, y: 2 }], direction: 'left', color: 0 };

describe('bodyPoints', () => {
  it('runs from behind the tail through the corner to just past the head centre', () => {
    expect(bodyPoints(ell, style)).toEqual([
      { x: 0.5 - style.tailReach, y: 0.5 },
      { x: 1.5, y: 0.5 },
      { x: 1.5, y: 1.5 + style.bodyEnd },
    ]);
  });

  it('draws a one-cell arrow as a short straight line along its direction', () => {
    expect(bodyPoints(single, style)).toEqual([
      { x: 3.5 + style.tailReach, y: 2.5 },
      { x: 3.5 - style.bodyEnd, y: 2.5 },
    ]);
  });

  it('keeps every point inside the arrow cells, so neighbouring paths never touch', () => {
    for (const point of bodyPoints(ell, style)) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(2);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(2);
    }
  });
});

describe('headPoints', () => {
  it('puts the tip ahead of the head centre and the base across the direction', () => {
    const [tip, left, right] = headPoints(ell, style);
    expect(tip).toEqual({ x: 1.5, y: 1.5 + style.headTip });
    const baseY = 1.5 + style.headTip - style.headDepth;
    expect(left!.y).toBeCloseTo(baseY);
    expect(right!.y).toBeCloseTo(baseY);
    expect(Math.abs(left!.x - right!.x)).toBeCloseTo(2 * style.headHalfWidth);
  });

  it('lands the tip and the end of the tail on the edge of the cell, a node of the grid', () => {
    // The head is filled, not stroked: its tip is where it is drawn.
    expect(style.headTip).toBe(0.5);
    // The body's round cap reaches half a stroke past its last point.
    expect(style.tailReach + style.strokeWidth / 2).toBeCloseTo(0.5);
  });

  it('covers the end of the body line', () => {
    expect(style.bodyEnd).toBeGreaterThan(style.headTip - style.headDepth);
    expect(style.bodyEnd + style.strokeWidth / 2).toBeLessThan(style.headTip);
  });
});

describe('simplify and path data', () => {
  it('drops collinear points and keeps corners', () => {
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]);
  });

  it('writes compact path data with rounded numbers', () => {
    expect(
      pathData([
        { x: 0.1234, y: 0 },
        { x: 1, y: 2 / 3 },
      ]),
    ).toBe('M0.123 0L1 0.667');
    expect(
      polygonData([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe('M0 0L1 0L0 1Z');
  });

  it('measures polylines', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(7);
  });
});

describe('exitTrack', () => {
  it('continues the body straight along the ray past the edge', () => {
    const track = exitTrack(ell, style, 4);
    const body = bodyPoints(ell, style);
    expect(track.bodyLength).toBeCloseTo(polylineLength(body));
    expect(track.travel).toBeCloseTo(track.bodyLength + 4 + 1.5);
    const end = track.points[track.points.length - 1]!;
    expect(end.x).toBeCloseTo(1.5);
    expect(end.y).toBeCloseTo(1.5 + style.bodyEnd + track.travel);
    // The last body point merges into the straight run.
    expect(track.points).toHaveLength(body.length);
  });

  it('takes 250 to 400 ms whatever the distance', () => {
    expect(exitDuration(0, motion)).toBe(250);
    expect(exitDuration(5, motion)).toBeGreaterThan(250);
    expect(exitDuration(500, motion)).toBe(400);
  });
});

describe('gridData and bounds', () => {
  it('draws a line every half cell, through the centres and along the edges', () => {
    // 2x1: three horizontal lines (top edge, centre, bottom edge), five vertical ones.
    expect(gridData(rectangleMask(2, 1))).toBe(
      'M0 0H2M0 0.5H2M0 1H2M0 0V1M0.5 0V1M1 0V1M1.5 0V1M2 0V1',
    );
  });

  it('has a node at every corner, tip and tail end of an arrow', () => {
    const d = gridData(rectangleMask(3, 2));
    // Centre lines (corners) and edge lines (tips and tails) both run the board's length.
    expect(d).toContain('M0 0.5H3');
    expect(d).toContain('M0 1H3');
    expect(d).toContain('M2.5 0V2');
    expect(d).toContain('M3 0V2');
  });

  it('skips inactive cells of a drawing', () => {
    expect(gridData(maskFromAscii(['A.', '..']))).toBe('M0 0H1M0 0.5H1M0 1H1M0 0V1M0.5 0V1M1 0V1');
  });

  it('breaks a line where a drawing has a gap', () => {
    expect(gridData(maskFromAscii(['A.A']))).toBe(
      'M0 0H1M2 0H3M0 0.5H1M2 0.5H3M0 1H1M2 1H3M0 0V1M0.5 0V1M1 0V1M2 0V1M2.5 0V1M3 0V1',
    );
  });

  it('adds the margin around the board', () => {
    expect(boardBounds(6, 8, 0.5)).toEqual({ minX: -0.5, minY: -0.5, maxX: 6.5, maxY: 8.5 });
  });
});
