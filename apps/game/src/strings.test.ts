import { describe, expect, it } from 'vitest';
import {
  formatDateKey,
  formatDayLong,
  formatDayShort,
  formatCountdown,
  formatDuration,
  formatMonth,
  formatMonthShort,
  ordinal,
  spellOut,
  t,
  tn,
  weekdayNames,
} from './strings.ts';

describe('t', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('title.level', { n: 12 })).toBe('Level 12');
    expect(t('hud.chances', { n: 2, total: 3 })).toBe('2 of 3 chances left');
    expect(t('title.level')).toBe('Level {n}');
  });
});

describe('tn', () => {
  it('picks the singular for one and the plural otherwise', () => {
    expect(tn('status.blocked', 1)).toBe('Blocked. 1 chance left.');
    expect(tn('status.blocked', 2)).toBe('Blocked. 2 chances left.');
    expect(tn('status.blocked', 0)).toBe('Blocked. 0 chances left.');
    expect(tn('board.label', 1)).toMatch(/^Board, 1 arrow left\./);
    expect(tn('board.label', 142)).toMatch(/^Board, 142 arrows left\./);
  });
});

describe('spellOut', () => {
  it('spells small counts and keeps digits from 11', () => {
    expect(spellOut(3)).toBe('three');
    expect(spellOut(0)).toBe('zero');
    expect(spellOut(10)).toBe('ten');
    expect(spellOut(11)).toBe('11');
    expect(t('lost.body', { total: spellOut(3) })).toBe(
      'Retry plays the same puzzle again, with three fresh chances and the timer reset.',
    );
  });
});

describe('formatDuration', () => {
  it('shows mm:ss, and hours when needed', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration(61_999)).toBe('01:01');
    expect(formatDuration(3_600_000 + 5_000)).toBe('1:00:05');
  });
});

describe('formatDateKey', () => {
  it('formats a day key like the reference game', () => {
    expect(formatDateKey('2026-10-02')).toBe('Oct 2, 2026');
  });
});

describe('formatDayShort', () => {
  it('names a day the way the home screen shows it, in any time zone', () => {
    expect(formatDayShort('2026-10-03')).toBe('Sat 3 Oct');
    expect(formatDayShort('2027-01-01')).toBe('Fri 1 Jan');
  });
});

describe('day and month names', () => {
  it('names days and months the same way in every engine', () => {
    expect(formatDayShort('2026-09-05')).toBe('Sat 5 Sep');
    expect(formatDayLong('2026-10-03')).toBe('Saturday 3 October');
    expect(formatDayLong('2026-10-05')).toBe('Monday 5 October');
    expect(formatDateKey('2026-09-30')).toBe('Sep 30, 2026');
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
    expect(formatMonthShort('2026-09', 2026)).toBe('Sep');
    expect(formatMonthShort('2025-12', 2026)).toBe('Dec 2025');
  });

  it('heads the calendar’s weeks from Monday', () => {
    expect(weekdayNames().map((name) => name.narrow)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayNames()[0]!.long).toBe('Monday');
    expect(weekdayNames()[6]!.long).toBe('Sunday');
  });
});

describe('ordinal', () => {
  it('names ranks in English', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 30, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '10th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '30th',
      '101st',
      '111th',
    ]);
  });
});

describe('formatCountdown', () => {
  it('shows hours and minutes, rounding minutes up', () => {
    expect(formatCountdown((7 * 60 + 47) * 60_000 + 30_000)).toBe('7h 48m');
    expect(formatCountdown(3_600_000)).toBe('1h 0m');
    expect(formatCountdown(12 * 60_000)).toBe('12m');
    expect(formatCountdown(5_000)).toBe('1m');
    expect(formatCountdown(0)).toBe('1m');
  });
});
