import { describe, expect, it } from 'vitest';
import { rectangleMask, maskFromAscii } from '../board/mask.ts';
import type { Puzzle } from '../board/types.ts';
import { renderAscii } from './ascii.ts';

describe('renderAscii', () => {
  it('draws bodies, heads, inactive cells and cleared cells', () => {
    const puzzle: Puzzle = {
      width: 3,
      height: 3,
      mask: maskFromAscii(['AAA', 'AAA', 'AA.']),
      rayMode: 'bounds',
      seed: 'ascii',
      arrows: [
        {
          id: 0,
          cells: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          direction: 'left',
          color: 0,
        },
        {
          id: 1,
          cells: [
            { x: 2, y: 1 },
            { x: 2, y: 0 },
          ],
          direction: 'up',
          color: 0,
        },
        {
          id: 2,
          cells: [
            { x: 0, y: 2 },
            { x: 1, y: 2 },
          ],
          direction: 'right',
          color: 0,
        },
      ],
    };
    expect(renderAscii(puzzle)).toBe(['─┐↑', '←┘│', '─→.'].join('\n'));
    expect(renderAscii(puzzle, new Set([1]))).toBe(['  ↑', '  │', '  .'].join('\n'));
  });

  it('renders a single-cell arrow as its head', () => {
    const puzzle: Puzzle = {
      width: 1,
      height: 1,
      mask: rectangleMask(1, 1),
      rayMode: 'bounds',
      seed: 'one',
      arrows: [{ id: 0, cells: [{ x: 0, y: 0 }], direction: 'down', color: 0 }],
    };
    expect(renderAscii(puzzle)).toBe('↓');
  });
});
