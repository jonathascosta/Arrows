import { describe, expect, it } from 'vitest';
import { activeCount } from '../board/mask.ts';
import { DRAWINGS, drawingMask, findDrawing } from './drawings.ts';

describe('drawings', () => {
  it('parse to masks with the legend as palette', () => {
    for (const drawing of DRAWINGS) {
      const mask = drawingMask(drawing);
      expect(activeCount(mask)).toBeGreaterThan(20);
      expect(mask.palette).toEqual(Object.values(drawing.legend));
      expect(drawing.rows.every((row) => row.length === mask.width)).toBe(true);
    }
  });

  it('are found by id', () => {
    expect(findDrawing('heart')?.name).toBe('Heart');
    expect(findDrawing('nope')).toBeUndefined();
  });

  it('the butterfly is left-right symmetric', () => {
    for (const row of DRAWINGS.find((d) => d.id === 'butterfly')!.rows) {
      expect(row).toBe(Array.from(row).reverse().join(''));
    }
  });
});
