import { describe, expect, it } from 'vitest';
import type { Direction } from '../board/direction.ts';
import { rectangleMask } from '../board/mask.ts';
import type { Cell, Mask, Puzzle, RayMode } from '../board/types.ts';
import { head } from '../board/types.ts';
import { DRAWINGS, drawingMask } from '../drawings/drawings.ts';
import { generateBoard } from '../levels/levels.ts';
import { TIERS, TIER_ORDER } from '../levels/tiers.ts';
import { clearArrow, createOccupancy, rayStatus } from '../solver/occupancy.ts';
import { endConflicts, endNodes, separateEnds } from './ends.ts';
import { generatePuzzle } from './generate.ts';

const cells = (...points: [number, number][]): Cell[] => points.map(([x, y]) => ({ x, y }));

/** Plays the arrows in the given order; every move must be legal and the board end empty. */
function expectOrderSolves(
  mask: Mask,
  inOrder: readonly { cells: readonly Cell[]; direction: Direction; color: number }[],
  rayMode: RayMode = 'bounds',
): void {
  const arrows = inOrder.map((arrow, id) => ({ id, ...arrow }));
  const puzzle: Puzzle = {
    width: mask.width,
    height: mask.height,
    mask,
    arrows,
    rayMode,
    seed: 'test',
  };
  const occupancy = createOccupancy(puzzle);
  for (const arrow of arrows) {
    expect(rayStatus(mask, occupancy, head(arrow), arrow.direction, rayMode).blockers).toBe(0);
    clearArrow(occupancy, mask, arrow);
  }
  expect(occupancy.every((owner) => owner === -1)).toBe(true);
}

describe('end nodes', () => {
  it('put the tip beyond the head and the tail behind the tail cell', () => {
    const mask = rectangleMask(5, 5);
    // (1,1) -> (2,1) -> (2,2), pointing down: tip on the edge (2,2)|(2,3), tail on (0,1)|(1,1).
    const nodes = endNodes(mask, cells([1, 1], [2, 1], [2, 2]), 'down');
    const other = endNodes(mask, cells([2, 3], [2, 4]), 'down'); // tail on (2,2)|(2,3)
    expect(nodes.tip).toBe(other.tail);
    expect(endNodes(mask, cells([0, 1]), 'right').tip).toBe(nodes.tail);
    // At the border, an end has no node.
    expect(endNodes(mask, cells([3, 0], [4, 0]), 'right').tip).toBe(-1);
  });

  it('find tip to tail and tail to tail, not ends on different edges', () => {
    const mask = rectangleMask(6, 1);
    // A: (0,0)->(1,0) pointing right, into B's tail at (2,0); B: (2,0)->(3,0) right.
    const tipToTail = endConflicts(mask, [
      { cells: cells([0, 0], [1, 0]), direction: 'right' },
      { cells: cells([2, 0], [3, 0]), direction: 'right' },
    ]);
    expect(tipToTail).toEqual([{ a: 0, b: 1, kind: 'tipToTail' }]);
    // Tails back to back at (1,0)|(2,0).
    const tailToTail = endConflicts(mask, [
      { cells: cells([1, 0], [0, 0]), direction: 'left' },
      { cells: cells([2, 0], [3, 0]), direction: 'right' },
    ]);
    expect(tailToTail.map((c) => c.kind)).toEqual(['tailToTail']);
    // A single pointing up sits on its top and bottom edges only.
    expect(
      endConflicts(rectangleMask(3, 3), [
        { cells: cells([0, 1], [1, 1]), direction: 'right' },
        { cells: cells([2, 0], [2, 1], [2, 2]), direction: 'down' },
      ]),
    ).toEqual([]);
  });
});

describe('separateEnds', () => {
  it('joins an arrow pointing into a tail in front of that tail', () => {
    const mask = rectangleMask(5, 1);
    const inOrder = [
      { cells: cells([2, 0], [3, 0], [4, 0]), direction: 'right' as const, color: 0 },
      { cells: cells([0, 0], [1, 0]), direction: 'right' as const, color: 0 },
    ];
    const result = separateEnds(mask, inOrder);
    expect(result.arrows).toEqual([
      { cells: cells([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]), direction: 'right', color: 0 },
    ]);
    expect(result.merges).toBe(1);
    expectOrderSolves(mask, result.arrows);
  });

  it('moves the later tail up to its first turn, or all of a straight arrow', () => {
    // Row 0: E leaves first to the left; L's tail backs onto E's, then L turns down.
    const mask = rectangleMask(5, 2);
    const early = { cells: cells([1, 0], [0, 0]), direction: 'left' as const, color: 0 };
    const late = { cells: cells([2, 0], [3, 0], [3, 1]), direction: 'down' as const, color: 0 };
    const rest = [
      { cells: cells([4, 0], [4, 1]), direction: 'down' as const, color: 0 },
      { cells: cells([2, 1], [1, 1], [0, 1]), direction: 'left' as const, color: 0 },
    ];
    const turned = separateEnds(mask, [early, rest[0]!, rest[1]!, late]);
    expect(turned.transfers).toBe(1);
    expect(turned.arrows[0]!.cells).toEqual(cells([2, 0], [1, 0], [0, 0]));
    expect(turned.arrows[3]!.cells).toEqual(cells([3, 0], [3, 1]));
    expect(endConflicts(mask, turned.arrows)).toEqual([]);
    expectOrderSolves(mask, turned.arrows);

    const line = rectangleMask(4, 1);
    const straight = separateEnds(line, [
      { cells: cells([1, 0], [0, 0]), direction: 'left', color: 0 },
      { cells: cells([2, 0], [3, 0]), direction: 'right', color: 0 },
    ]);
    expect(straight.arrows).toEqual([
      { cells: cells([3, 0], [2, 0], [1, 0], [0, 0]), direction: 'left', color: 0 },
    ]);
  });

  it('never joins two colours', () => {
    const mask = rectangleMask(4, 1);
    const result = separateEnds(mask, [
      { cells: cells([2, 0], [3, 0]), direction: 'right', color: 1 },
      { cells: cells([0, 0], [1, 0]), direction: 'right', color: 0 },
    ]);
    expect(result.arrows).toHaveLength(2);
    expect(result.left).toBe(1);
  });

  it('property: no two ends share a node, on thousands of boards of every tier', () => {
    let fixes = 0;
    for (const tier of TIER_ORDER) {
      const { partition, peel } = TIERS[tier];
      for (const [width, height] of [
        [6, 8],
        [9, 13],
        [14, 21],
        [3, 17],
      ] as const) {
        for (let i = 0; i < 40; i++) {
          const mask = rectangleMask(width, height);
          for (const rayMode of ['bounds', 'mask'] as const) {
            const { puzzle, analysis, endFixes } = generatePuzzle({
              mask,
              seed: `ends:${tier}:${width}x${height}:${rayMode}:${i}`,
              partition,
              peel,
              rayMode,
            });
            expect(analysis.solvable).toBe(true);
            expect(endConflicts(mask, puzzle.arrows)).toEqual([]);
            fixes += endFixes;
          }
        }
      }
    }
    // The fix runs for real in this sweep.
    expect(fixes).toBeGreaterThan(100);
  });

  it('property: no two ends share a node on the drawings, at every tier, in both ray modes', () => {
    for (const drawing of DRAWINGS) {
      for (const tier of TIER_ORDER) {
        for (const rayMode of ['bounds', 'mask'] as const) {
          for (let i = 0; i < 6; i++) {
            const { puzzle, analysis } = generateBoard({
              id: `ends:${drawing.id}:${tier}:${rayMode}:${i}`,
              mask: drawingMask(drawing),
              tier,
              rayMode,
            });
            expect(analysis.solvable).toBe(true);
            expect(endConflicts(puzzle.mask, puzzle.arrows), `${drawing.id} ${tier}`).toEqual([]);
          }
        }
      }
    }
  });
});
