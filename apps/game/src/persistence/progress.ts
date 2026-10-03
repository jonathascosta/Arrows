import type { KeyValueStore } from './store.ts';

export const PROGRESS_KEY = 'arrows.progress';

/**
 * What the player has done on the level path (docs/PRODUCT.md, Levels).
 * Stored as JSON with a version from day one, so a later shape can migrate
 * the old one instead of losing it.
 */
export interface Progress {
  readonly version: 1;
  /** The next level to play: one past the highest level won. */
  readonly currentLevel: number;
  /** Best time per level, in milliseconds, keyed by level number. */
  readonly bestTimes: Readonly<Record<string, number>>;
  /** Consecutive first-try wins on levels. */
  readonly streak: number;
  readonly bestStreak: number;
  /**
   * The level a board was last lost on, until that level is won: winning it is
   * not a first try even after a reload.
   */
  readonly lostLevel: number | null;
}

export const INITIAL_PROGRESS: Progress = {
  version: 1,
  currentLevel: 1,
  bestTimes: {},
  streak: 0,
  bestStreak: 0,
  lostLevel: null,
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * Reads stored progress. Anything missing, malformed or from an unknown
 * future version falls back field by field to the initial values, so a bad
 * write costs at most what it touched.
 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return INITIAL_PROGRESS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return INITIAL_PROGRESS;
  }
  if (typeof data !== 'object' || data === null) return INITIAL_PROGRESS;
  const record = data as Record<string, unknown>;
  // Version 1 is the only one so far; a migration from it goes here when a version 2 exists.
  if (record.version !== 1) return INITIAL_PROGRESS;
  const bestTimes: Record<string, number> = {};
  const times = record.bestTimes;
  if (typeof times === 'object' && times !== null && !Array.isArray(times)) {
    for (const [level, ms] of Object.entries(times as Record<string, unknown>)) {
      if (/^[1-9]\d*$/.test(level) && isCount(ms)) bestTimes[level] = ms;
    }
  }
  const currentLevel =
    isCount(record.currentLevel) && record.currentLevel >= 1 ? record.currentLevel : 1;
  const streak = isCount(record.streak) ? record.streak : 0;
  const bestStreak = isCount(record.bestStreak) ? Math.max(record.bestStreak, streak) : streak;
  const lostLevel = isCount(record.lostLevel) && record.lostLevel >= 1 ? record.lostLevel : null;
  return { version: 1, currentLevel, bestTimes, streak, bestStreak, lostLevel };
}

export interface LevelWin {
  readonly level: number;
  readonly elapsedMs: number;
  /** No board was lost on this level while it was open. */
  readonly firstTry: boolean;
}

export interface WinRecord {
  readonly progress: Progress;
  /** Counted as a first try: no board lost on the level, in this visit or a stored one. */
  readonly firstTry: boolean;
  readonly streak: number;
  /** The best time after this win. */
  readonly bestMs: number;
  /** The best time before this win; none on the first win of the level. */
  readonly previousBestMs: number | undefined;
  /** This win beat an earlier best time (false for a first win). */
  readonly newBest: boolean;
}

/** The progress of this device, read once and written on every change. */
export class ProgressStore {
  private value: Progress;
  private readonly store: KeyValueStore;

  constructor(store: KeyValueStore) {
    this.store = store;
    this.value = parseProgress(store.getItem(PROGRESS_KEY));
  }

  get progress(): Progress {
    return this.value;
  }

  bestTime(level: number): number | undefined {
    return this.value.bestTimes[String(level)];
  }

  recordWin(win: LevelWin): WinRecord {
    const previous = this.bestTime(win.level);
    const elapsed = Math.max(0, Math.round(win.elapsedMs));
    const bestMs = previous === undefined ? elapsed : Math.min(previous, elapsed);
    const firstTry = win.firstTry && this.value.lostLevel !== win.level;
    const streak = firstTry ? this.value.streak + 1 : 0;
    this.save({
      ...this.value,
      currentLevel: Math.max(this.value.currentLevel, win.level + 1),
      bestTimes: { ...this.value.bestTimes, [String(win.level)]: bestMs },
      streak,
      bestStreak: Math.max(this.value.bestStreak, streak),
      lostLevel: this.value.lostLevel === win.level ? null : this.value.lostLevel,
    });
    return {
      progress: this.value,
      firstTry,
      streak,
      bestMs,
      previousBestMs: previous,
      newBest: previous !== undefined && elapsed < previous,
    };
  }

  /** A lost board ends the streak, and winning its level later does not start a new one. */
  recordLoss(level: number): Progress {
    this.save({ ...this.value, streak: 0, lostLevel: level });
    return this.value;
  }

  private save(progress: Progress): void {
    this.value = progress;
    this.store.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }
}
