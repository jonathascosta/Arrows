import { describe, expect, it } from 'vitest';
import { localDateKey, parseRoute, puzzleHref, routeSearch } from './route.ts';
import type { PuzzleRef } from './route.ts';

describe('parseRoute', () => {
  it('reads levels, dailies and drawings', () => {
    expect(parseRoute('?level=300')).toEqual({ kind: 'level', level: 300 });
    expect(parseRoute('?daily=2026-10-03')).toEqual({ kind: 'daily', dateKey: '2026-10-03' });
    expect(parseRoute('?drawing=butterfly&tier=hard')).toEqual({
      kind: 'drawing',
      drawingId: 'butterfly',
      tier: 'hard',
    });
  });

  it('reads no puzzle, or an invalid one, as the home screen; a bad tier as medium', () => {
    for (const search of [
      '',
      '?level=0',
      '?level=-3',
      '?level=1.5',
      '?level=abc',
      '?daily=2026-02-30',
      '?drawing=nope',
    ]) {
      expect(parseRoute(search)).toBeNull();
    }
    expect(parseRoute('?drawing=heart&tier=impossible')).toEqual({
      kind: 'drawing',
      drawingId: 'heart',
      tier: 'medium',
    });
  });

  it('round-trips through routeSearch', () => {
    const refs: PuzzleRef[] = [
      { kind: 'level', level: 42 },
      { kind: 'daily', dateKey: '2026-12-31' },
      { kind: 'drawing', drawingId: 'heart', tier: 'superHard' },
    ];
    for (const ref of refs) expect(parseRoute(routeSearch(ref))).toEqual(ref);
    expect(puzzleHref({ kind: 'level', level: 7 })).toBe('./?level=7');
  });
});

describe('localDateKey', () => {
  it('uses the local calendar date', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 9, 3, 0, 1))).toBe('2026-10-03');
  });
});
