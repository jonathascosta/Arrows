import { generateDaily, generateLevel } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { loadPuzzle, tierLabel } from './puzzles.ts';

describe('loadPuzzle', () => {
  it('loads the same level the engine generates', () => {
    const loaded = loadPuzzle({ kind: 'level', level: 13 });
    expect(loaded.puzzle.arrows).toEqual(generateLevel(13).puzzle.arrows);
    expect(loaded.tier).toBe('hard');
    expect(loaded.title).toBe('Level 13');
  });

  it('loads a daily with its date as the title', () => {
    const loaded = loadPuzzle({ kind: 'daily', dateKey: '2026-10-03' });
    expect(loaded.puzzle.arrows).toEqual(generateDaily('2026-10-03').puzzle.arrows);
    expect(loaded.title).toBe('Daily · Oct 3, 2026');
  });

  it('loads a drawing with the bounds ray rule, the same every time', () => {
    const ref = { kind: 'drawing', drawingId: 'butterfly', tier: 'hard' } as const;
    const loaded = loadPuzzle(ref);
    expect(loaded.puzzle.rayMode).toBe('bounds');
    expect(loaded.title).toBe('Butterfly');
    expect(loadPuzzle(ref).puzzle.arrows).toEqual(loaded.puzzle.arrows);
  });

  it('rejects an unknown drawing', () => {
    expect(() => loadPuzzle({ kind: 'drawing', drawingId: 'nope', tier: 'easy' })).toThrow(
      RangeError,
    );
  });

  it('labels tiers for players', () => {
    expect(tierLabel('superHard')).toBe('Super Hard');
  });
});
