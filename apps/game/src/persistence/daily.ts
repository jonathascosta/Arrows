import type { DateKey } from '../daily/days.ts';
import { isDateKey } from '../daily/days.ts';
import { monthComplete } from '../daily/month.ts';
import { isCount, readJson, RecordSlot } from './record.ts';
import type { KeyValueStore } from './store.ts';

export const DAILY_KEY = 'arrows.daily';
export const DAILY_VERSION = 1;

/** A day won, with its best time. A lost day is not stored (docs/PRODUCT.md). */
export interface DayResult {
  readonly bestMs: number;
}

/** The daily challenge results of this device, by day key. */
export interface DailyResults {
  readonly version: typeof DAILY_VERSION;
  readonly days: Readonly<Record<DateKey, DayResult>>;
}

export const INITIAL_DAILY: DailyResults = { version: DAILY_VERSION, days: {} };

/**
 * Reads stored daily results. Nothing stored, broken JSON or another version
 * gives no results; in a version 1 record each day is kept or dropped on its own.
 */
export function parseDailyResults(raw: string | null): DailyResults {
  const record = readJson(raw);
  if (record?.version !== DAILY_VERSION) return INITIAL_DAILY;
  const days: Record<DateKey, DayResult> = {};
  const stored = record.days;
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    for (const [dateKey, result] of Object.entries(stored as Record<string, unknown>)) {
      const bestMs =
        typeof result === 'object' && result !== null
          ? (result as Record<string, unknown>).bestMs
          : undefined;
      if (isDateKey(dateKey) && isCount(bestMs)) days[dateKey] = { bestMs };
    }
  }
  return { version: DAILY_VERSION, days };
}

export interface DailyWin {
  /** The day had been won before: this is a replay. */
  readonly replay: boolean;
  readonly bestMs: number;
  /** The best time before this win; none on the day's first win. */
  readonly previousBestMs: number | undefined;
  readonly newBest: boolean;
  /** This first win completes its month: a trophy. */
  readonly monthComplete: boolean;
}

export class DailyStore {
  private readonly slot: RecordSlot<DailyResults>;

  constructor(store: KeyValueStore) {
    this.slot = new RecordSlot(store, DAILY_KEY, DAILY_VERSION, parseDailyResults, INITIAL_DAILY);
  }

  get results(): DailyResults {
    return this.slot.read();
  }

  /** The days won, for the calendar. */
  finished(): Set<DateKey> {
    return new Set(Object.keys(this.results.days));
  }

  bestTime(dateKey: DateKey): number | undefined {
    return this.results.days[dateKey]?.bestMs;
  }

  /** Stores a won day. `today` decides which days count towards the month. */
  recordWin(dateKey: DateKey, elapsedMs: number, today: DateKey): DailyWin {
    const results = this.results;
    const previous = results.days[dateKey]?.bestMs;
    const elapsed = Math.max(0, Math.round(elapsedMs));
    const bestMs = previous === undefined ? elapsed : Math.min(previous, elapsed);
    const days = { ...results.days, [dateKey]: { bestMs } };
    this.slot.write({ ...results, days });
    const replay = previous !== undefined;
    return {
      replay,
      bestMs,
      previousBestMs: previous,
      newBest: previous !== undefined && elapsed < previous,
      monthComplete: !replay && monthComplete(dateKey, today, new Set(Object.keys(days))),
    };
  }
}
