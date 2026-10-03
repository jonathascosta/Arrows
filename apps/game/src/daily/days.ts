import { weekdayOf } from '@arrows/engine';

/** A day in the device's local calendar, `YYYY-MM-DD`. */
export type DateKey = string;
/** A month, `YYYY-MM`. */
export type MonthKey = string;

/**
 * The first daily (docs/PRODUCT.md, Daily challenge): the calendar starts in
 * its month, and no earlier day can be opened. It moves to the launch month
 * before release (T10).
 */
export const DAILY_FIRST_DAY: DateKey = '2026-01-01';

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Whether a string is a real calendar day as `YYYY-MM-DD`. */
export function isDateKey(value: string): boolean {
  try {
    weekdayOf(value);
    return true;
  } catch {
    return false;
  }
}

export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Today's date key in the device's local time zone (docs/PRODUCT.md). */
export function localDateKey(date: Date = new Date()): DateKey {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function monthOf(dateKey: DateKey): MonthKey {
  return dateKey.slice(0, 7);
}

function parts(month: MonthKey): [number, number] {
  return [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
}

/** The month `n` months after `month` (before, when `n` is negative). */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const [year, m] = parts(month);
  const index = year * 12 + (m - 1) + n;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${two((index % 12) + 1)}`;
}

export function daysInMonth(month: MonthKey): number {
  const [year, m] = parts(month);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function dayOfMonth(month: MonthKey, day: number): DateKey {
  return `${month}-${two(day)}`;
}

/** Monday is 0 and Sunday 6: the calendar's weeks start on Monday. */
export function mondayIndex(dateKey: DateKey): number {
  return (weekdayOf(dateKey) + 6) % 7;
}

/** A day that can be opened today: from the first daily up to today. */
export function isPlayableDay(dateKey: DateKey, today: DateKey): boolean {
  // Date keys compare as strings in calendar order.
  return isDateKey(dateKey) && dateKey >= DAILY_FIRST_DAY && dateKey <= today;
}

/** Seconds since local midnight on the device's clock. */
export function secondsOfDay(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/** Milliseconds until the next local midnight, on days of 23 or 25 hours too. */
export function msUntilMidnight(date: Date): number {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next.getTime() - date.getTime();
}
