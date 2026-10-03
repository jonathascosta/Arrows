import type { DateKey, MonthKey } from './days.ts';
import {
  addMonths,
  DAILY_FIRST_DAY,
  dayOfMonth,
  daysInMonth,
  isPlayableDay,
  mondayIndex,
  monthOf,
} from './days.ts';

export interface DayCell {
  readonly dateKey: DateKey;
  readonly day: number;
  readonly today: boolean;
  /** Won: the day has its star. */
  readonly done: boolean;
  /** Can be opened: not in the future and not before the first daily. */
  readonly playable: boolean;
}

/** One month of the calendar (docs/DESIGN.md, Daily challenge). */
export interface MonthModel {
  readonly month: MonthKey;
  /** Empty cells before the first day, in a week that starts on Monday. */
  readonly leadingBlanks: number;
  readonly days: readonly DayCell[];
  readonly stars: number;
  readonly total: number;
  /** The neighbouring months the calendar can show, or null at either end. */
  readonly previous: MonthKey | null;
  readonly next: MonthKey | null;
}

export const FIRST_MONTH: MonthKey = monthOf(DAILY_FIRST_DAY);

/** A month the calendar can show: from the first daily's month to today's. */
export function clampMonth(month: MonthKey, today: DateKey): MonthKey {
  const last = monthOf(today);
  return month < FIRST_MONTH ? FIRST_MONTH : month > last ? last : month;
}

/** Stars of a month: days won, counting only days that can be opened. */
function starsOf(month: MonthKey, today: DateKey, finished: ReadonlySet<DateKey>): number {
  let stars = 0;
  for (let day = 1; day <= daysInMonth(month); day++) {
    const dateKey = dayOfMonth(month, day);
    if (finished.has(dateKey) && isPlayableDay(dateKey, today)) stars++;
  }
  return stars;
}

export function monthModel(
  month: MonthKey,
  today: DateKey,
  finished: ReadonlySet<DateKey>,
): MonthModel {
  const total = daysInMonth(month);
  const days: DayCell[] = [];
  for (let day = 1; day <= total; day++) {
    const dateKey = dayOfMonth(month, day);
    const playable = isPlayableDay(dateKey, today);
    days.push({
      dateKey,
      day,
      today: dateKey === today,
      done: playable && finished.has(dateKey),
      playable,
    });
  }
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  return {
    month,
    leadingBlanks: mondayIndex(dayOfMonth(month, 1)),
    days,
    stars: days.filter((cell) => cell.done).length,
    total,
    previous: previous >= FIRST_MONTH ? previous : null,
    next: next <= monthOf(today) ? next : null,
  };
}

export interface Trophy {
  readonly month: MonthKey;
  readonly stars: number;
  readonly total: number;
  /** Every day of the month won. */
  readonly complete: boolean;
}

/**
 * The trophies row: every month before today's with at least one star, from
 * the most recent back to the first daily's month.
 */
export function trophies(today: DateKey, finished: ReadonlySet<DateKey>): Trophy[] {
  const row: Trophy[] = [];
  for (
    let month = addMonths(monthOf(today), -1);
    month >= FIRST_MONTH;
    month = addMonths(month, -1)
  ) {
    const stars = starsOf(month, today, finished);
    if (stars === 0) continue;
    const total = daysInMonth(month);
    row.push({ month, stars, total, complete: stars === total });
  }
  return row;
}

/** Whether every day of the month of `dateKey` is won. */
export function monthComplete(
  dateKey: DateKey,
  today: DateKey,
  finished: ReadonlySet<DateKey>,
): boolean {
  const month = monthOf(dateKey);
  return starsOf(month, today, finished) === daysInMonth(month);
}
