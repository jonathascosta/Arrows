import { describe, expect, it } from 'vitest';
import { activeCount, cellIndex, colorAt, maskFromAscii, rectangleMask } from '../board/mask.ts';
import type { Mask, Path } from '../board/types.ts';
import { BUTTERFLY } from '../drawings/art.ts';
import { drawingMask } from '../drawings/drawings.ts';
import { createRng } from '../rng/rng.ts';
import { partition } from './partition.ts';

/** Every active cell in exactly one path; paths adjacent, simple and one-coloured. */
export function expectValidPartition(mask: Mask, paths: readonly Path[], maxLength: number): void {
  const seen = new Set<number>();
  for (const path of paths) {
    expect(path.cells.length).toBeGreaterThanOrEqual(1);
    expect(path.cells.length).toBeLessThanOrEqual(maxLength);
    path.cells.forEach((cell, i) => {
      const index = cellIndex(mask, cell.x, cell.y);
      expect(mask.active[index]).toBe(1);
      expect(seen.has(index)).toBe(false);
      seen.add(index);
      expect(colorAt(mask, cell.x, cell.y)).toBe(path.color);
      if (i > 0) {
        const prev = path.cells[i - 1]!;
        expect(Math.abs(prev.x - cell.x) + Math.abs(prev.y - cell.y)).toBe(1);
      }
    });
  }
  expect(seen.size).toBe(activeCount(mask));
}

describe('partition', () => {
  it('covers a rectangle exactly once with adjacent simple paths', () => {
    const mask = rectangleMask(9, 13);
    const paths = partition(mask, createRng('partition'), { meanLength: 4, maxLength: 10 });
    expectValidPartition(mask, paths, 10);
  });

  it('keeps every path inside one colour of a drawing', () => {
    const mask = drawingMask(BUTTERFLY);
    const paths = partition(mask, createRng('butterfly'), { meanLength: 5, maxLength: 12 });
    expectValidPartition(mask, paths, 12);
    expect(new Set(paths.map((path) => path.color)).size).toBe(3);
  });

  it('is deterministic for a seed', () => {
    const mask = rectangleMask(7, 7);
    const a = partition(mask, createRng('same'), { meanLength: 3, maxLength: 8 });
    const b = partition(mask, createRng('same'), { meanLength: 3, maxLength: 8 });
    expect(a).toEqual(b);
  });

  it('honours maxLength 1 (every cell its own path)', () => {
    const mask = rectangleMask(4, 4);
    const paths = partition(mask, createRng('ones'), { meanLength: 3, maxLength: 1 });
    expect(paths).toHaveLength(16);
  });

  it('handles a mask of isolated cells and a single-cell mask', () => {
    const dots = maskFromAscii(['A.A', '...', 'A.A']);
    expect(partition(dots, createRng('dots'), { meanLength: 4, maxLength: 8 })).toHaveLength(4);
    const one = maskFromAscii(['A']);
    expect(partition(one, createRng('one'), { meanLength: 4, maxLength: 8 })).toHaveLength(1);
  });

  it('leaves few stranded single cells on a plain board', () => {
    const mask = rectangleMask(14, 20);
    let singles = 0;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const paths = partition(mask, createRng(`singles:${i}`), { meanLength: 5, maxLength: 14 });
      singles += paths.filter((path) => path.cells.length === 1).length;
      total += paths.length;
    }
    expect(singles / total).toBeLessThan(0.2);
  });
});
