import { describe, expect, it } from 'vitest';
import {
  calendarHref,
  parseRoute,
  puzzleHref,
  puzzleKey,
  puzzleSearch,
  routeHref,
} from './route.ts';
import type { PuzzleRef, Route } from './route.ts';

const play = (ref: PuzzleRef): Route => ({ screen: 'play', ref });

describe('parseRoute', () => {
  it('reads levels, dailies and drawings', () => {
    expect(parseRoute('?level=300')).toEqual(play({ kind: 'level', level: 300 }));
    expect(parseRoute('?daily=2026-10-03')).toEqual(play({ kind: 'daily', dateKey: '2026-10-03' }));
    expect(parseRoute('?event=autumn-2026&board=3')).toEqual(
      play({ kind: 'event', eventId: 'autumn-2026', board: 3 }),
    );
    expect(parseRoute('?event=autumn-2026')).toEqual(
      play({ kind: 'event', eventId: 'autumn-2026', board: 1 }),
    );
    expect(parseRoute('?drawing=butterfly&tier=hard')).toEqual(
      play({ kind: 'drawing', drawingId: 'butterfly', tier: 'hard' }),
    );
  });

  it('reads the calendar, with or without a month', () => {
    expect(parseRoute('?calendar')).toEqual({ screen: 'calendar', month: null });
    expect(parseRoute('?calendar=2026-09')).toEqual({ screen: 'calendar', month: '2026-09' });
    expect(parseRoute('?calendar=2026-13')).toEqual({ screen: 'calendar', month: null });
  });

  it('reads nothing, or an invalid puzzle, as the home screen; a bad tier as medium', () => {
    for (const search of [
      '',
      '?level=0',
      '?level=-3',
      '?level=1.5',
      '?level=abc',
      '?daily=2026-02-30',
      '?drawing=nope',
      '?event=nope',
      '?event=autumn-2026&board=7',
      '?event=autumn-2026&board=0',
    ]) {
      expect(parseRoute(search), search).toEqual({ screen: 'home' });
    }
    expect(parseRoute('?drawing=heart&tier=impossible')).toEqual(
      play({ kind: 'drawing', drawingId: 'heart', tier: 'medium' }),
    );
  });

  it('round-trips every route through its address', () => {
    const routes: Route[] = [
      { screen: 'home' },
      { screen: 'calendar', month: null },
      { screen: 'calendar', month: '2026-02' },
      { screen: 'league' },
      play({ kind: 'level', level: 1 }),
      play({ kind: 'daily', dateKey: '2026-12-31' }),
      play({ kind: 'drawing', drawingId: 'heart', tier: 'superHard' }),
      play({ kind: 'event', eventId: 'autumn-2026', board: 6 }),
    ];
    for (const route of routes) {
      expect(parseRoute(routeHref(route).slice(2))).toEqual(route);
    }
    expect(puzzleHref({ kind: 'level', level: 7 })).toBe('./?level=7');
    expect(puzzleSearch({ kind: 'daily', dateKey: '2026-10-03' })).toBe('?daily=2026-10-03');
    expect(calendarHref()).toBe('./?calendar');
    expect(calendarHref('2026-09')).toBe('./?calendar=2026-09');
    expect(routeHref({ screen: 'home' })).toBe('./');
  });
});

describe('puzzleKey', () => {
  it('names each board once, whatever its address', () => {
    expect(puzzleKey({ kind: 'level', level: 12 })).toBe('level:12');
    expect(puzzleKey({ kind: 'daily', dateKey: '2026-10-03' })).toBe('daily:2026-10-03');
    expect(puzzleKey({ kind: 'event', eventId: 'autumn-2026', board: 2 })).toBe(
      'event:autumn-2026:2',
    );
    expect(puzzleKey({ kind: 'drawing', drawingId: 'butterfly', tier: 'hard' })).toBe(
      'drawing:butterfly:hard',
    );
  });
});
