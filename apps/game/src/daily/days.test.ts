import { afterEach, describe, expect, it } from 'vitest';
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
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
  });

  it('is the date on the device’s clock, not in UTC', () => {
    // 23:30 UTC on 3 October: already the 4th in London (summer time) and Tokyo,
    // still the 3rd in Los Angeles.
    const instant = new Date('2026-10-03T23:30:00Z');
    process.env.TZ = 'Europe/London';
    expect(localDateKey(instant)).toBe('2026-10-04');
    process.env.TZ = 'Asia/Tokyo';
    expect(localDateKey(instant)).toBe('2026-10-04');
    process.env.TZ = 'America/Los_Angeles';
    expect(localDateKey(instant)).toBe('2026-10-03');
    process.env.TZ = 'UTC';
    expect(localDateKey(instant)).toBe('2026-10-03');
  });

  it('turns at local midnight', () => {
    process.env.TZ = 'America/Sao_Paulo';
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
