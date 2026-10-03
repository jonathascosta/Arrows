import { isCount, readJson, RecordSlot } from './record.ts';
import type { KeyValueStore } from './store.ts';

export const PROGRESS_KEY = 'arrows.progress';

/** The shape this build reads and writes. */
export const PROGRESS_VERSION = 1;

/**
 * What the player has done on the level path (docs/PRODUCT.md, Levels).
 * Stored as JSON with a version from day one, so a later shape can migrate
 * the old one instead of losing it.
 */
export interface Progress {
  readonly version: typeof PROGRESS_VERSION;
  /** The next level to play: one past the highest level won. */
  readonly currentLevel: number;
  /** Best time per level won, in milliseconds, keyed by level number. */
  readonly bestTimes: Readonly<Record<string, number>>;
  /** Consecutive first-try wins on new levels. */
  readonly streak: number;
  readonly bestStreak: number;
  /**
   * Levels a board was lost on and that have not been won since: winning one
   * of them is not a first try, even after a reload.
   */
  readonly lostLevels: readonly number[];
}

export const INITIAL_PROGRESS: Progress = {
  version: PROGRESS_VERSION,
  currentLevel: 1,
  bestTimes: {},
  streak: 0,
  bestStreak: 0,
  lostLevels: [],
};

const isLevel = (value: unknown): value is number => isCount(value) && value >= 1;

/**
 * Reads stored progress. Nothing stored, broken JSON or another version gives
 * the initial progress. In a version 1 record, each missing or malformed field
 * falls back to its initial value on its own, so a bad write costs at most
 * what it touched.
 */
export function parseProgress(raw: string | null): Progress {
  const record = readJson(raw);
  // Version 1 is the only one so far; a migration from it goes here when a version 2 exists.
  if (record?.version !== PROGRESS_VERSION) return INITIAL_PROGRESS;
  const bestTimes: Record<string, number> = {};
  const times = record.bestTimes;
  if (typeof times === 'object' && times !== null && !Array.isArray(times)) {
    for (const [level, ms] of Object.entries(times as Record<string, unknown>)) {
      if (/^[1-9]\d*$/.test(level) && isCount(ms)) bestTimes[level] = ms;
    }
  }
  const currentLevel = isLevel(record.currentLevel) ? record.currentLevel : 1;
  const streak = isCount(record.streak) ? record.streak : 0;
  const bestStreak = isCount(record.bestStreak) ? Math.max(record.bestStreak, streak) : streak;
  const lostLevels = Array.isArray(record.lostLevels)
    ? [...new Set(record.lostLevels.filter(isLevel))]
    : [];
  return { version: PROGRESS_VERSION, currentLevel, bestTimes, streak, bestStreak, lostLevels };
}

export interface LevelResult {
  readonly level: number;
  readonly elapsedMs: number;
  /** No board was lost on this level while it was open. */
  readonly firstTry: boolean;
}

export interface WinRecord {
  readonly progress: Progress;
  /** The level had been won before: the streak is left as it was. */
  readonly replay: boolean;
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

/**
 * The progress of this device. Every read and every change goes to the store
 * (see `RecordSlot`), so an out-of-date copy never overwrites newer progress.
 */
export class ProgressStore {
  private readonly slot: RecordSlot<Progress>;

  constructor(store: KeyValueStore) {
    this.slot = new RecordSlot(
      store,
      PROGRESS_KEY,
      PROGRESS_VERSION,
      parseProgress,
      INITIAL_PROGRESS,
    );
  }

  get progress(): Progress {
    return this.slot.read();
  }

  bestTime(level: number): number | undefined {
    return this.progress.bestTimes[String(level)];
  }

  recordWin(win: LevelResult): WinRecord {
    const value = this.progress;
    const key = String(win.level);
    const previous = value.bestTimes[key];
    const replay = previous !== undefined;
    const elapsed = Math.max(0, Math.round(win.elapsedMs));
    const bestMs = previous === undefined ? elapsed : Math.min(previous, elapsed);
    const firstTry = win.firstTry && !value.lostLevels.includes(win.level);
    // A replay leaves the streak alone (docs/PRODUCT.md, Levels).
    const streak = replay ? value.streak : firstTry ? value.streak + 1 : 0;
    const progress: Progress = {
      ...value,
      currentLevel: Math.max(value.currentLevel, win.level + 1),
      bestTimes: { ...value.bestTimes, [key]: bestMs },
      streak,
      bestStreak: Math.max(value.bestStreak, streak),
      lostLevels: value.lostLevels.filter((level) => level !== win.level),
    };
    this.save(progress);
    return {
      progress,
      replay,
      firstTry,
      streak,
      bestMs,
      previousBestMs: previous,
      newBest: previous !== undefined && elapsed < previous,
    };
  }

  /**
   * A lost board on a level not won yet ends the streak, and winning that level
   * later does not start a new one. A lost replay changes nothing.
   */
  recordLoss(level: number): Progress {
    const value = this.progress;
    if (value.bestTimes[String(level)] !== undefined) return value;
    const progress: Progress = {
      ...value,
      streak: 0,
      lostLevels: value.lostLevels.includes(level)
        ? value.lostLevels
        : [...value.lostLevels, level],
    };
    this.save(progress);
    return progress;
  }

  private save(progress: Progress): void {
    this.slot.write(progress);
  }
}
