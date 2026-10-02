import type { Direction } from '../board/direction.ts';
import { directionBetween } from '../board/direction.ts';
import { cellIndex } from '../board/mask.ts';
import type { Puzzle } from '../board/types.ts';

const HEAD: Readonly<Record<Direction, string>> = { up: '↑', right: '→', down: '↓', left: '←' };

const BODY: Readonly<Record<string, string>> = {
  'up:down': '│',
  'down:up': '│',
  'left:right': '─',
  'right:left': '─',
  'up:right': '└',
  'right:up': '└',
  'up:left': '┘',
  'left:up': '┘',
  'down:right': '┌',
  'right:down': '┌',
  'down:left': '┐',
  'left:down': '┐',
};

/**
 * The puzzle as text, one character per cell: box drawing for bodies, an
 * arrow for each head, `.` for inactive cells and a space for cleared cells
 * when `remaining` is given. For tests, fixtures and bug reports.
 */
export function renderAscii(puzzle: Puzzle, remaining?: ReadonlySet<number>): string {
  const { width, height, mask } = puzzle;
  const chars: string[] = Array.from({ length: width * height }, (_, i) =>
    mask.active[i] === 1 ? ' ' : '.',
  );
  for (const arrow of puzzle.arrows) {
    if (remaining && !remaining.has(arrow.id)) continue;
    const { cells } = arrow;
    cells.forEach((cell, i) => {
      const index = cellIndex(mask, cell.x, cell.y);
      if (i === cells.length - 1) {
        chars[index] = HEAD[arrow.direction];
        return;
      }
      const next = directionBetween(cell, cells[i + 1]!);
      const prev = i === 0 ? next : directionBetween(cell, cells[i - 1]!);
      chars[index] = i === 0 ? tailChar(next) : BODY[`${prev}:${next}`]!;
    });
  }
  const rows: string[] = [];
  for (let y = 0; y < height; y++) rows.push(chars.slice(y * width, (y + 1) * width).join(''));
  return rows.join('\n');
}

function tailChar(towards: Direction): string {
  return towards === 'up' || towards === 'down' ? '│' : '─';
}
