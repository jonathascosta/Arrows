import { tierForLevel } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { levelStrip } from './levelStrip.ts';

describe('levelStrip', () => {
  it('centres the current level with three done before it', () => {
    const strip = levelStrip(42);
    expect(strip.map((item) => item.level)).toEqual([39, 40, 41, 42, 43, 44, 45]);
    expect(strip.map((item) => item.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'next',
      'next',
      'next',
    ]);
    for (const item of strip) expect(item.tier).toBe(tierForLevel(item.level));
  });

  it('starts at level 1 near the start of the path', () => {
    expect(levelStrip(1).map((item) => item.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(levelStrip(1)[0]!.state).toBe('current');
    expect(levelStrip(3).map((item) => item.state)).toEqual([
      'done',
      'done',
      'current',
      'next',
      'next',
      'next',
      'next',
    ]);
  });

  it('takes another size', () => {
    expect(levelStrip(10, 5).map((item) => item.level)).toEqual([8, 9, 10, 11, 12]);
  });
});
