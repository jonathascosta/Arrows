import { describe, expect, it } from 'vitest';
import { activeCount } from '../board/mask.ts';
import { generateBoard } from '../levels/levels.ts';
import { TIER_ORDER } from '../levels/tiers.ts';
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

  it('the butterfly and the maple leaf are left-right symmetric', () => {
    for (const id of ['butterfly', 'maple-leaf']) {
      for (const row of findDrawing(id)!.rows) {
        expect(row, id).toBe(Array.from(row).reverse().join(''));
      }
    }
  });

  it('make a board at every tier, in the bounds ray rule events use', () => {
    for (const drawing of DRAWINGS) {
      for (const tier of TIER_ORDER) {
        const board = generateBoard({
          id: `test:${drawing.id}:${tier}`,
          mask: drawingMask(drawing),
          tier,
          rayMode: 'bounds',
        });
        expect(board.analysis.solvable, `${drawing.id} ${tier}`).toBe(true);
        expect(board.puzzle.arrows.length).toBeGreaterThan(5);
      }
    }
  });
});
