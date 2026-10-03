import { describe, expect, it } from 'vitest';
import { directionBetween } from '../board/direction.ts';
import { activeCount, maskFromAscii, rectangleMask } from '../board/mask.ts';
import type { Mask, Puzzle, RayMode } from '../board/types.ts';
import { head } from '../board/types.ts';
import { BUTTERFLY, HEART } from '../drawings/art.ts';
import { drawingMask } from '../drawings/drawings.ts';
import { createRng } from '../rng/rng.ts';
import { clearArrow, createOccupancy, rayStatus } from '../solver/occupancy.ts';
import { partition } from './partition.ts';
import { peel } from './peel.ts';

function build(mask: Mask, seed: string, rayMode: RayMode, bias = 0.5) {
  const rng = createRng(seed);
  const paths = partition(mask, rng.fork('partition'), { meanLength: 4, maxLength: 10 });
  const result = peel(mask, paths, rng.fork('peel'), { bias }, rayMode);
  const puzzle: Puzzle = {
    width: mask.width,
    height: mask.height,
    mask,
    arrows: result.arrows,
    rayMode,
    seed,
  };
  return { puzzle, result };
}

/** Plays the given order and expects every move to be legal and the board to end empty. */
export function expectSolution(puzzle: Puzzle, order: readonly number[]): void {
  const occupancy = createOccupancy(puzzle);
  const seen = new Set<number>();
  for (const id of order) {
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    const arrow = puzzle.arrows[id]!;
    const status = rayStatus(puzzle.mask, occupancy, head(arrow), arrow.direction, puzzle.rayMode);
    expect(status.blockers).toBe(0);
    clearArrow(occupancy, puzzle.mask, arrow);
  }
  expect(seen.size).toBe(puzzle.arrows.length);
  expect(occupancy.every((value) => value === -1)).toBe(true);
}

describe('peel', () => {
  it('gives every path a head that points along its last segment and ids by position', () => {
    const { puzzle } = build(rectangleMask(9, 13), 'heads', 'bounds');
    puzzle.arrows.forEach((arrow, i) => {
      expect(arrow.id).toBe(i);
      if (arrow.cells.length > 1) {
        const n = arrow.cells.length;
        expect(directionBetween(arrow.cells[n - 2]!, arrow.cells[n - 1]!)).toBe(arrow.direction);
      }
    });
    for (let i = 1; i < puzzle.arrows.length; i++) {
      const a = head(puzzle.arrows[i - 1]!);
      const b = head(puzzle.arrows[i]!);
      expect(a.y < b.y || (a.y === b.y && a.x < b.x)).toBe(true);
    }
  });

  it('returns a solution that plays out legally', () => {
    const { puzzle, result } = build(rectangleMask(9, 13), 'solution', 'bounds');
    expectSolution(puzzle, result.solution);
  });

  it('covers every active cell exactly once', () => {
    const mask = drawingMask(BUTTERFLY);
    const { puzzle } = build(mask, 'cover', 'mask');
    const cells = puzzle.arrows.flatMap((arrow) => arrow.cells.map((c) => `${c.x},${c.y}`));
    expect(new Set(cells).size).toBe(cells.length);
    expect(cells.length).toBe(activeCount(mask));
  });

  it('cuts the topmost cell out of its path when no end is free, and still solves', () => {
    // 4x3, three paths whose every end points at another path:
    //   U: (1,0)->(0,0)->(0,1)->(0,2)->(1,2)   ends point right, into V
    //   V: (2,0)->(3,0)->(3,1)->(3,2)->(2,2)   ends point left, into U
    //   W: (1,1)->(2,1)                        ends point left and right, into U and V
    const mask = rectangleMask(4, 3);
    const u = [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ];
    const v = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
    ];
    const w = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    const result = peel(
      mask,
      [
        { cells: u, color: 0 },
        { cells: v, color: 0 },
        { cells: w, color: 0 },
      ],
      createRng('deadlock'),
      { bias: 0 },
      'bounds',
    );
    expect(result.repairs).toBeGreaterThanOrEqual(1);
    // U was cut at (0,0): the single cell, (1,0) and the rest are now separate arrows.
    expect(result.arrows.length).toBeGreaterThanOrEqual(5);
    const single = result.arrows.find(
      (arrow) => arrow.cells.length === 1 && arrow.cells[0]!.x === 0 && arrow.cells[0]!.y === 0,
    );
    expect(single?.direction).toBe('up');
    expectSolution(
      { width: 4, height: 3, mask, arrows: result.arrows, rayMode: 'bounds', seed: 'deadlock' },
      result.solution,
    );
  });

  it('property: thousands of seeds, both ray modes, several masks, always solvable', () => {
    const masks: [string, Mask][] = [
      ['6x8', rectangleMask(6, 8)],
      ['9x13', rectangleMask(9, 13)],
      ['1x1', rectangleMask(1, 1)],
      ['1x12', rectangleMask(1, 12)],
      ['12x1', rectangleMask(12, 1)],
      ['heart', drawingMask(HEART)],
      ['butterfly', drawingMask(BUTTERFLY)],
      ['ring', maskFromAscii(['AAAAA', 'A...A', 'A...A', 'AAAAA'])],
      ['islands', maskFromAscii(['AA.BB', 'AA.BB', '.....', 'CC.DD'])],
    ];
    let repairs = 0;
    for (const [name, mask] of masks) {
      for (const rayMode of ['bounds', 'mask'] as const) {
        for (let i = 0; i < 60; i++) {
          const { puzzle, result } = build(
            mask,
            `${name}:${rayMode}:${i}`,
            rayMode,
            i % 2 === 0 ? 0 : 0.9,
          );
          expectSolution(puzzle, result.solution);
          repairs += result.repairs;
        }
      }
    }
    // The repair path runs for real somewhere in this sweep.
    expect(repairs).toBeGreaterThan(0);
  });

  it('property: the scored peel (fresh ends, cuts) always solves, both ray modes', () => {
    const options = [
      {
        bias: 0.85,
        freshness: 1,
        commitment: 1000,
        queuePenalty: 4,
        staleCut: 0,
        cutMinPiece: 3,
        repair: 'cut',
      },
      { bias: 0.6, freshness: 1, commitment: 1000, queuePenalty: 4, staleCut: 4, repair: 'cut' },
      { bias: 0, freshness: 1 },
    ] as const;
    const masks: [string, Mask][] = [
      ['9x13', rectangleMask(9, 13)],
      ['14x21', rectangleMask(14, 21)],
      ['1x12', rectangleMask(1, 12)],
      ['butterfly', drawingMask(BUTTERFLY)],
      ['ring', maskFromAscii(['AAAAA', 'A...A', 'A...A', 'AAAAA'])],
    ];
    let cuts = 0;
    for (const [name, mask] of masks) {
      for (const rayMode of ['bounds', 'mask'] as const) {
        for (let i = 0; i < 30; i++) {
          const rng = createRng(`scored:${name}:${rayMode}:${i}`);
          const paths = partition(mask, rng.fork('partition'), {
            meanLength: 12,
            maxLength: 30,
            turn: 0.5,
            growBothEnds: true,
            joinBelow: 4,
          });
          const result = peel(mask, paths, rng.fork('peel'), options[i % options.length]!, rayMode);
          const puzzle: Puzzle = {
            width: mask.width,
            height: mask.height,
            mask,
            arrows: result.arrows,
            rayMode,
            seed: 's',
          };
          expectSolution(puzzle, result.solution);
          cuts += result.repairs;
        }
      }
    }
    expect(cuts).toBeGreaterThan(0);
  });

  it('peels the end freed most recently: few arrows free at a time along the solution', () => {
    const mask = rectangleMask(14, 21);
    const freeAlong = (options: Parameters<typeof peel>[3]): number => {
      let sum = 0;
      let steps = 0;
      for (let i = 0; i < 10; i++) {
        const rng = createRng(`fresh:${i}`);
        const paths = partition(mask, rng.fork('partition'), {
          meanLength: 16,
          maxLength: 40,
          turn: 0.5,
          growBothEnds: true,
          joinBelow: 4,
        });
        const { arrows, solution } = peel(mask, paths, rng.fork('peel'), options, 'bounds');
        const puzzle: Puzzle = {
          width: 14,
          height: 21,
          mask,
          arrows,
          rayMode: 'bounds',
          seed: 'f',
        };
        const occupancy = createOccupancy(puzzle);
        const left = new Set(arrows.map((arrow) => arrow.id));
        for (const id of solution) {
          for (const other of left) {
            const arrow = arrows[other]!;
            if (rayStatus(mask, occupancy, head(arrow), arrow.direction, 'bounds').blockers === 0)
              sum++;
          }
          steps++;
          clearArrow(occupancy, mask, arrows[id]!);
          left.delete(id);
        }
      }
      return sum / steps;
    };
    const random = freeAlong({ bias: 0.85 });
    const fresh = freeAlong({
      bias: 0.85,
      freshness: 1,
      commitment: 1000,
      queuePenalty: 4,
      staleCut: 0,
      cutMinPiece: 3,
      repair: 'cut',
    });
    // About 2.8 against 3.6 on these seeds.
    expect(fresh).toBeLessThan(3.2);
    expect(fresh).toBeLessThan(random * 0.85);
  });
});
