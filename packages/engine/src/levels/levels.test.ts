import { describe, expect, it } from 'vitest';
import { createRng, cyrb53 } from '../rng/rng.ts';
import { BUTTERFLY } from '../drawings/art.ts';
import { drawingMask } from '../drawings/drawings.ts';
import { renderAscii } from '../debug/ascii.ts';
import { dailySpec, generateBoard, generateDaily, generateLevel, weekdayOf } from './levels.ts';
import { PLATEAU_LEVEL, TIERS, boardSizeForLevel, tierForLevel } from './tiers.ts';

describe('tierForLevel', () => {
  it('follows the documented pattern', () => {
    expect(
      Array.from({ length: 10 }, (_, i) => tierForLevel(i + 1)).every((t) => t === 'easy'),
    ).toBe(true);
    expect(Array.from({ length: 10 }, (_, i) => tierForLevel(11 + i))).toEqual([
      'medium',
      'medium',
      'hard',
      'medium',
      'medium',
      'medium',
      'hard',
      'medium',
      'medium',
      'superHard',
    ]);
    expect(tierForLevel(300)).toBe('superHard');
    expect(tierForLevel(303)).toBe('hard');
    expect(tierForLevel(301)).toBe('medium');
    expect(() => tierForLevel(0)).toThrow(RangeError);
    expect(() => tierForLevel(1.5)).toThrow(RangeError);
  });
});

describe('boardSizeForLevel', () => {
  it('starts at the base and grows to the plateau', () => {
    expect(boardSizeForLevel(11)).toEqual([9, 13]);
    expect(boardSizeForLevel(PLATEAU_LEVEL, 'medium')).toEqual([13, 19]);
    expect(boardSizeForLevel(PLATEAU_LEVEL * 3, 'medium')).toEqual([13, 19]);
    expect(boardSizeForLevel(300)).toEqual([20, 29]);
    expect(boardSizeForLevel(1)).toEqual([6, 8]);
    expect(boardSizeForLevel(10)).toEqual([6, 8]);
  });
});

describe('generateLevel', () => {
  it('is the same puzzle every time', () => {
    const a = generateLevel(77);
    const b = generateLevel(77);
    expect(a.puzzle.arrows).toEqual(b.puzzle.arrows);
    expect(a.tier).toBe('hard');
    expect(a.analysis.solvable).toBe(true);
  });

  /**
   * Changing the generator changes every player's level N. This pins the
   * content: update the hashes only on purpose, with a note in the changelog.
   */
  it('pins the content of a few levels', () => {
    const fingerprint = (level: number): string => {
      const text = renderAscii(generateLevel(level).puzzle);
      return cyrb53(text)
        .map((word) => word.toString(16))
        .join('-');
    };
    expect({
      1: fingerprint(1),
      11: fingerprint(11),
      13: fingerprint(13),
      300: fingerprint(300),
    }).toEqual({
      1: 'a33a3ed9-99c1caef',
      11: '9c7dd6ef-e819e42d',
      13: '1be81293-2a1a45c6',
      300: 'a5c94a1b-9b7d24d2',
    });
  });

  it('lands in the tier band for a sample of levels', () => {
    for (const level of [1, 7, 11, 13, 20, 50, 97, 150, 213, 300, 303, 450]) {
      const { tier, analysis } = generateLevel(level);
      const [low, high] = TIERS[tier].target.avgFreeRatio;
      expect(analysis.avgFreeRatio, `level ${level} (${tier})`).toBeGreaterThanOrEqual(low);
      expect(analysis.avgFreeRatio, `level ${level} (${tier})`).toBeLessThanOrEqual(high);
    }
  });
});

describe('generateDaily', () => {
  it('validates the date key and picks hard boards at weekends', () => {
    expect(weekdayOf('2026-10-02')).toBe(5);
    expect(() => weekdayOf('2026-02-30')).toThrow(RangeError);
    expect(() => weekdayOf('02/10/2026')).toThrow(RangeError);
    expect(generateDaily('2026-10-02').tier).toBe('medium');
    expect(generateDaily('2026-10-03').tier).toBe('hard');
    expect(generateDaily('2026-10-04').puzzle.width).toBe(18);
  });

  it('tells the board of a day without generating it', () => {
    expect(dailySpec('2026-10-02')).toEqual({
      weekend: false,
      tier: 'medium',
      width: 16,
      height: 24,
    });
    expect(dailySpec('2026-10-04')).toEqual({ weekend: true, tier: 'hard', width: 18, height: 27 });
    for (const dateKey of ['2026-10-02', '2026-10-03']) {
      const { puzzle, tier } = generateDaily(dateKey);
      const spec = dailySpec(dateKey);
      expect([tier, puzzle.width, puzzle.height]).toEqual([spec.tier, spec.width, spec.height]);
    }
    expect(() => dailySpec('2026-13-01')).toThrow(RangeError);
  });

  it('differs by day and repeats for the same day', () => {
    expect(generateDaily('2026-10-02').puzzle.arrows).toEqual(
      generateDaily('2026-10-02').puzzle.arrows,
    );
    expect(generateDaily('2026-10-02').puzzle.arrows).not.toEqual(
      generateDaily('2026-10-05').puzzle.arrows,
    );
  });
});

describe('generateBoard', () => {
  it('generates a solvable board on a drawing in both ray modes', () => {
    for (const rayMode of ['bounds', 'mask'] as const) {
      const board = generateBoard({
        id: `event-1:${rayMode}`,
        mask: drawingMask(BUTTERFLY),
        tier: 'hard',
        rayMode,
      });
      expect(board.puzzle.rayMode).toBe(rayMode);
      expect(board.analysis.solvable).toBe(true);
      // Every arrow is one colour of the drawing.
      for (const arrow of board.puzzle.arrows) {
        expect(
          new Set(arrow.cells.map((c) => board.puzzle.mask.color[c.y * board.puzzle.width + c.x]))
            .size,
        ).toBe(1);
        expect(arrow.color).toBeLessThan(3);
      }
    }
  });

  it('a seed never leaks between kinds', () => {
    const rng = createRng('level:1');
    expect(rng.seed).toBe('level:1');
    expect(generateLevel(1).puzzle.seed).not.toBe(
      generateBoard({ id: '1', mask: drawingMask(BUTTERFLY), tier: 'easy' }).puzzle.seed,
    );
  });
});
