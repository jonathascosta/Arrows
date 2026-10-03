import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addMonths,
  DAILY_FIRST_DAY,
  dayOfMonth,
  daysInMonth,
  isDateKey,
  isMonthKey,
  isPlayableDay,
  localDateKey,
  mondayIndex,
  monthOf,
} from './days.ts';

describe('localDateKey', () => {
  // vi.stubEnv puts TZ back as it was, unset included, so other tests keep their zone.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is the date on the device’s clock, not in UTC', () => {
    // 23:30 UTC on 3 October: already the 4th in London (summer time) and Tokyo,
    // still the 3rd in Los Angeles.
    const instant = new Date('2026-10-03T23:30:00Z');
    vi.stubEnv('TZ', 'Europe/London');
    expect(localDateKey(instant)).toBe('2026-10-04');
    vi.stubEnv('TZ', 'Asia/Tokyo');
    expect(localDateKey(instant)).toBe('2026-10-04');
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(localDateKey(instant)).toBe('2026-10-03');
    vi.stubEnv('TZ', 'UTC');
    expect(localDateKey(instant)).toBe('2026-10-03');
  });

  it('keeps the day across a change of the clocks', () => {
    // Britain leaves summer time at 02:00 on 25 October 2026: 01:00 to 02:00 happens twice.
    vi.stubEnv('TZ', 'Europe/London');
    expect(localDateKey(new Date('2026-10-24T22:59:00Z'))).toBe('2026-10-24'); // 23:59 BST
    expect(localDateKey(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25'); // 00:30 BST
    expect(localDateKey(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25'); // 01:30 GMT
    expect(localDateKey(new Date('2026-10-25T23:59:00Z'))).toBe('2026-10-25'); // 23:59 GMT
    expect(localDateKey(new Date('2026-10-26T00:00:00Z'))).toBe('2026-10-26');
  });

  it('turns at local midnight', () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
    expect(localDateKey(new Date(2026, 9, 3, 23, 59, 59))).toBe('2026-10-03');
    expect(localDateKey(new Date(2026, 9, 4, 0, 0, 0))).toBe('2026-10-04');
    expect(localDateKey(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01-01');
  });
});

describe('date and month keys', () => {
  it('accepts only real days and months', () => {
    expect(isDateKey('2026-10-03')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-10-3', '03/10/2026', '', 'today']) {
      expect(isDateKey(bad), bad).toBe(false);
    }
    expect(isMonthKey('2026-10')).toBe(true);
    for (const bad of ['2026-13', '2026-00', '2026-1', '2026-10-03', '']) {
      expect(isMonthKey(bad), bad).toBe(false);
    }
  });

  it('moves between months across years', () => {
    expect(monthOf('2026-10-03')).toBe('2026-10');
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });

  it('counts the days of each month, leap years included', () => {
    expect(daysInMonth('2026-10')).toBe(31);
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2100-02')).toBe(28);
    expect(dayOfMonth('2026-10', 3)).toBe('2026-10-03');
  });

  it('numbers weekdays from Monday', () => {
    expect(mondayIndex('2026-10-05')).toBe(0); // Monday
    expect(mondayIndex('2026-10-03')).toBe(5); // Saturday
    expect(mondayIndex('2026-10-04')).toBe(6); // Sunday
  });

  it('opens days from the first daily up to today', () => {
    const today = '2026-10-03';
    expect(isPlayableDay(today, today)).toBe(true);
    expect(isPlayableDay('2026-10-02', today)).toBe(true);
    expect(isPlayableDay(DAILY_FIRST_DAY, today)).toBe(true);
    expect(isPlayableDay('2026-10-04', today)).toBe(false);
    expect(isPlayableDay('2025-12-31', today)).toBe(false);
    expect(isPlayableDay('2026-02-30', today)).toBe(false);
  });
});
