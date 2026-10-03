import { describe, expect, it } from 'vitest';
import { clampMonth, FIRST_MONTH, monthComplete, monthModel, trophies } from './month.ts';

const days = (month: string, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${month}-${String(from + i).padStart(2, '0')}`);

describe('monthModel', () => {
  it('lays a month out in weeks from Monday', () => {
    // 1 October 2026 is a Thursday: three blanks (Mon, Tue, Wed).
    const october = monthModel('2026-10', '2026-10-14', new Set());
    expect(october.leadingBlanks).toBe(3);
    expect(october.days).toHaveLength(31);
    expect(october.days[0]).toEqual({
      dateKey: '2026-10-01',
      day: 1,
      today: false,
      done: false,
      playable: true,
    });
    // 1 June 2026 is a Monday: no blanks. 1 November 2026 is a Sunday: six.
    expect(monthModel('2026-06', '2026-10-14', new Set()).leadingBlanks).toBe(0);
    expect(monthModel('2026-11', '2026-11-01', new Set()).leadingBlanks).toBe(6);
  });

  it('marks today, the stars, and locks the days ahead', () => {
    const finished = new Set(['2026-10-01', '2026-10-13', '2026-10-14', '2026-10-20']);
    const october = monthModel('2026-10', '2026-10-14', finished);
    const cell = (day: number) => october.days[day - 1]!;
    expect(cell(14)).toMatchObject({ today: true, done: true, playable: true });
    expect(cell(13)).toMatchObject({ today: false, done: true, playable: true });
    expect(cell(2)).toMatchObject({ done: false, playable: true });
    expect(cell(15)).toMatchObject({ done: false, playable: false });
    // A star stored for a day ahead (a changed clock, a bad write) does not count.
    expect(cell(20)).toMatchObject({ done: false, playable: false });
    expect(october.stars).toBe(3);
    expect(october.total).toBe(31);
  });

  it('navigates from the first daily’s month up to today’s', () => {
    const october = monthModel('2026-10', '2026-10-14', new Set());
    expect(october.previous).toBe('2026-09');
    expect(october.next).toBeNull();
    const first = monthModel(FIRST_MONTH, '2026-10-14', new Set());
    expect(first.previous).toBeNull();
    expect(first.next).toBe('2026-02');
    expect(monthModel('2026-09', '2026-10-14', new Set()).next).toBe('2026-10');
    // Days before the first daily are locked, like days ahead.
    expect(monthModel('2025-12', '2026-10-14', new Set()).days.every((d) => !d.playable)).toBe(
      true,
    );
  });

  it('clamps a month into the calendar', () => {
    expect(clampMonth('2026-07', '2026-10-14')).toBe('2026-07');
    expect(clampMonth('2027-03', '2026-10-14')).toBe('2026-10');
    expect(clampMonth('2019-03', '2026-10-14')).toBe(FIRST_MONTH);
  });
});

describe('trophies', () => {
  it('shows earlier months with a star, newest first, complete or counted', () => {
    const finished = new Set([
      ...days('2026-09', 1, 30), // all of September: a trophy
      ...days('2026-07', 1, 29), // July missed by two days
      '2026-03-05',
      ...days('2026-10', 1, 14), // this month: not in the row
    ]);
    expect(trophies('2026-10-14', finished)).toEqual([
      { month: '2026-09', stars: 30, total: 30, complete: true },
      { month: '2026-07', stars: 29, total: 31, complete: false },
      { month: '2026-03', stars: 1, total: 31, complete: false },
    ]);
  });

  it('is empty before any star, and ignores days outside the calendar', () => {
    expect(trophies('2026-10-14', new Set())).toEqual([]);
    expect(trophies('2026-10-14', new Set(['2025-12-31', '2027-01-01']))).toEqual([]);
  });
});

describe('monthComplete', () => {
  it('is true once every day of the month is won', () => {
    const september = new Set(days('2026-09', 1, 29));
    expect(monthComplete('2026-09-10', '2026-10-14', september)).toBe(false);
    september.add('2026-09-30');
    expect(monthComplete('2026-09-10', '2026-10-14', september)).toBe(true);
    // The current month cannot be complete before its last day.
    expect(monthComplete('2026-10-14', '2026-10-14', new Set(days('2026-10', 1, 31)))).toBe(false);
  });
});
