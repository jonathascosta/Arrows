import { DELTA } from '../board/direction.ts';
import type { Direction } from '../board/direction.ts';
import { cellIndex, inBounds } from '../board/mask.ts';
import type { Arrow, Cell, Mask, Puzzle, RayMode } from '../board/types.ts';

/**
 * Who occupies each cell: an arrow id, or -1 for empty. Inactive cells are
 * always -1. The solver and the game state both work on this, and the ray
 * scan below never allocates, which matters on a 1,500-cell event board.
 */
export type Occupancy = Int32Array;

export function createOccupancy(puzzle: Puzzle): Occupancy {
  const occupancy = new Int32Array(puzzle.width * puzzle.height).fill(-1);
  for (const arrow of puzzle.arrows) placeArrow(occupancy, puzzle.mask, arrow);
  return occupancy;
}

export function placeArrow(occupancy: Occupancy, mask: Pick<Mask, 'width'>, arrow: Arrow): void {
  for (const cell of arrow.cells) occupancy[cellIndex(mask, cell.x, cell.y)] = arrow.id;
}

export function clearArrow(occupancy: Occupancy, mask: Pick<Mask, 'width'>, arrow: Arrow): void {
  for (const cell of arrow.cells) occupancy[cellIndex(mask, cell.x, cell.y)] = -1;
}

export interface RayStatus {
  /** Cells the ray crosses before the arrow is out. */
  readonly length: number;
  /** Occupied cells on the ray. The arrow is free when this is 0. */
  readonly blockers: number;
  /** The id in the first occupied cell, or -1. */
  readonly firstBlocker: number;
}

/**
 * Scans the ray in front of `from` in `direction`. An occupied cell counts as
 * a blocker whatever arrow it belongs to, the scanned arrow's own body included:
 * the rule the player sees is "the line in front must be empty".
 */
export function rayStatus(
  mask: Mask,
  occupancy: Occupancy,
  from: Cell,
  direction: Direction,
  mode: RayMode,
): RayStatus {
  const { dx, dy } = DELTA[direction];
  let x = from.x + dx;
  let y = from.y + dy;
  let length = 0;
  let blockers = 0;
  let firstBlocker = -1;
  while (inBounds(mask, x, y)) {
    const index = cellIndex(mask, x, y);
    if (mode === 'mask' && mask.active[index] !== 1) break;
    length++;
    const occupant = occupancy[index]!;
    if (occupant !== -1) {
      blockers++;
      if (firstBlocker === -1) firstBlocker = occupant;
    }
    x += dx;
    y += dy;
  }
  return { length, blockers, firstBlocker };
}

/** The cells the ray crosses, for animating the exit. */
export function rayCells(mask: Mask, from: Cell, direction: Direction, mode: RayMode): Cell[] {
  const { dx, dy } = DELTA[direction];
  const cells: Cell[] = [];
  let x = from.x + dx;
  let y = from.y + dy;
  while (inBounds(mask, x, y)) {
    if (mode === 'mask' && mask.active[cellIndex(mask, x, y)] !== 1) break;
    cells.push({ x, y });
    x += dx;
    y += dy;
  }
  return cells;
}

/** Every distinct arrow id on the ray, in order of distance. */
export function rayBlockers(
  mask: Mask,
  occupancy: Occupancy,
  from: Cell,
  direction: Direction,
  mode: RayMode,
): number[] {
  const ids: number[] = [];
  for (const cell of rayCells(mask, from, direction, mode)) {
    const occupant = occupancy[cellIndex(mask, cell.x, cell.y)]!;
    if (occupant !== -1 && !ids.includes(occupant)) ids.push(occupant);
  }
  return ids;
}
