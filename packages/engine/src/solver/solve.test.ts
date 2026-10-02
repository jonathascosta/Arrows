import { describe, expect, it } from 'vitest';
import { rectangleMask } from '../board/mask.ts';
import type { Puzzle } from '../board/types.ts';
import { generateLevel } from '../levels/levels.ts';
import { analyze, difficultyScore } from './solve.ts';
import { rayCells, rayStatus, createOccupancy } from './occupancy.ts';

const mask = rectangleMask(3, 2);

/** Two arrows: A across the top pointing right, B below it pointing up into A. */
const chain: Puzzle = {
  width: 3,
  height: 2,
  mask,
  rayMode: 'bounds',
  seed: 'chain',
  arrows: [
    {
      id: 0,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      direction: 'right',
      color: 0,
    },
    {
      id: 1,
      cells: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      direction: 'right',
      color: 0,
    },
    { id: 2, cells: [{ x: 2, y: 1 }], direction: 'up', color: 0 },
  ],
};

describe('analyze', () => {
  it('solves a small chain and reports its metrics', () => {
    const analysis = analyze(chain);
    expect(analysis.solvable).toBe(true);
    // Step 1: only 0 is free (2 is blocked by 0, 1 is blocked by 2). Step 2: only 2.
    // Step 3: 1, with a ray of one cell.
    expect(analysis.solution).toEqual([0, 2, 1]);
    expect(analysis.arrowCount).toBe(3);
    expect(analysis.cellCount).toBe(6);
    expect(analysis.avgPathLength).toBe(2);
    expect(analysis.maxPathLength).toBe(3);
    expect(analysis.singleRatio).toBeCloseTo(1 / 3);
    expect(analysis.freeAtStart).toBe(1);
    expect(analysis.minFree).toBe(1);
    expect(analysis.avgFree).toBe(1);
    expect(analysis.avgFreeRatio).toBeCloseTo(3 / (3 + 2 + 1));
    expect(analysis.avgRayLength).toBeCloseTo((0 + 1 + 1) / 3);
    expect(analysis.borderHeadRatio).toBeCloseTo(1 / 3);
    expect(analysis.avgNearMiss).toBeCloseTo((2 + 1 + 0) / 3);
    expect(analysis.difficulty).toBeGreaterThanOrEqual(0);
    expect(analysis.difficulty).toBeLessThanOrEqual(100);
  });

  it('reports an unsolvable puzzle without throwing', () => {
    const stuck: Puzzle = {
      ...chain,
      arrows: [
        { id: 0, cells: [{ x: 0, y: 0 }], direction: 'right', color: 0 },
        { id: 1, cells: [{ x: 1, y: 0 }], direction: 'left', color: 0 },
        { id: 2, cells: [{ x: 2, y: 0 }], direction: 'left', color: 0 },
        { id: 3, cells: [{ x: 0, y: 1 }], direction: 'up', color: 0 },
        { id: 4, cells: [{ x: 1, y: 1 }], direction: 'up', color: 0 },
        { id: 5, cells: [{ x: 2, y: 1 }], direction: 'up', color: 0 },
      ],
    };
    const analysis = analyze(stuck);
    expect(analysis.solvable).toBe(false);
    expect(analysis.solution).toEqual([]);
    expect(analysis.freeAtStart).toBe(0);
  });

  it('agrees with the generator on a real level', () => {
    const { puzzle, analysis } = generateLevel(42);
    expect(analysis.solvable).toBe(true);
    expect(analysis.solution).toHaveLength(puzzle.arrows.length);
  });
});

describe('rays', () => {
  it('counts blockers in bounds mode, including the arrow itself', () => {
    const occupancy = createOccupancy(chain);
    expect(rayStatus(mask, occupancy, { x: 2, y: 1 }, 'up', 'bounds')).toEqual({
      length: 1,
      blockers: 1,
      firstBlocker: 0,
    });
    expect(rayStatus(mask, occupancy, { x: 0, y: 1 }, 'right', 'bounds')).toEqual({
      length: 2,
      blockers: 2,
      firstBlocker: 1,
    });
    expect(rayCells(mask, { x: 0, y: 1 }, 'right', 'bounds')).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it('stops at the edge of the drawing in mask mode and crosses gaps in bounds mode', () => {
    const gap = { ...rectangleMask(5, 1), active: Uint8Array.from([1, 1, 0, 1, 1]) };
    expect(rayCells(gap, { x: 1, y: 0 }, 'right', 'mask')).toEqual([]);
    expect(rayCells(gap, { x: 1, y: 0 }, 'right', 'bounds')).toHaveLength(3);
  });
});

describe('difficultyScore', () => {
  it('grows with arrows, scarcity and ray length and stays within 0 to 100', () => {
    expect(difficultyScore(1, 1, 0)).toBe(0);
    expect(difficultyScore(500, 0, 10)).toBe(100);
    expect(difficultyScore(30, 0.25, 3)).toBeLessThan(difficultyScore(140, 0.07, 9));
  });
});
