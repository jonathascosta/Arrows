import type { Cell } from './types.ts';

export type Direction = 'up' | 'right' | 'down' | 'left';

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

export const DELTA: Readonly<Record<Direction, Readonly<{ dx: number; dy: number }>>> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

/** The direction that steps from `from` to the adjacent cell `to`. */
export function directionBetween(from: Cell, to: Cell): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 1 && dy === 0) return 'right';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  throw new RangeError(`Cells (${from.x},${from.y}) and (${to.x},${to.y}) are not adjacent`);
}

export function step(cell: Cell, direction: Direction): Cell {
  const { dx, dy } = DELTA[direction];
  return { x: cell.x + dx, y: cell.y + dy };
}
