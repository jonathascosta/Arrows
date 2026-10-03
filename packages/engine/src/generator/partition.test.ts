import { describe, expect, it } from 'vitest';
import { activeCount, cellIndex, colorAt, maskFromAscii, rectangleMask } from '../board/mask.ts';
import type { Cell, Mask, Path } from '../board/types.ts';
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

  it('winding walks grown from both ends and joined short paths stay a valid partition', () => {
    const options = { meanLength: 12, maxLength: 30, turn: 0.5, growBothEnds: true, joinBelow: 4 };
    let cells = 0;
    let paths = 0;
    for (let i = 0; i < 20; i++) {
      const mask = rectangleMask(14, 21);
      const result = partition(mask, createRng(`long:${i}`), options);
      expectValidPartition(mask, result, 30);
      cells += activeCount(mask);
      paths += result.length;
    }
    expect(cells / paths).toBeGreaterThan(8);
    const butterfly = drawingMask(BUTTERFLY);
    expectValidPartition(butterfly, partition(butterfly, createRng('long:b'), options), 30);
  });

  it('turns more often with `turn`', () => {
    const turns = (turn: number): number => {
      let count = 0;
      for (let i = 0; i < 10; i++) {
        for (const path of partition(rectangleMask(14, 21), createRng(`turn:${i}`), {
          meanLength: 10,
          maxLength: 24,
          turn,
        })) {
          for (let k = 2; k < path.cells.length; k++) {
            const [a, b, c] = [path.cells[k - 2]!, path.cells[k - 1]!, path.cells[k]!];
            if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) count++;
          }
        }
      }
      return count;
    };
    expect(turns(0.8)).toBeGreaterThan(turns(0) * 1.2);
  });

  it('leaves no two path ends of different colours facing each other on a drawing', () => {
    const mask = drawingMask(BUTTERFLY);
    for (let i = 0; i < 50; i++) {
      const paths = partition(mask, createRng(`facing:${i}`), { meanLength: 5, maxLength: 12 });
      expectValidPartition(mask, paths, 12);
      const nodes = new Map<string, number>();
      for (const path of paths) {
        if (path.cells.length < 2) continue;
        for (const [end, before] of [
          [path.cells[0]!, path.cells[1]!],
          [path.cells[path.cells.length - 1]!, path.cells[path.cells.length - 2]!],
        ] as [Cell, Cell][]) {
          const beyond = { x: 2 * end.x - before.x, y: 2 * end.y - before.y };
          const key = [end, beyond]
            .map((c) => `${c.x},${c.y}`)
            .sort()
            .join('|');
          const other = nodes.get(key);
          if (other !== undefined) expect(other).toBe(path.color);
          nodes.set(key, path.color);
        }
      }
    }
  });
});
