import { describe, expect, it } from 'vitest';
import {
  INITIAL_PROGRESS,
  isNewerRecord,
  parseProgress,
  PROGRESS_KEY,
  ProgressStore,
} from './progress.ts';
import { MemoryStore } from './store.ts';

const win = (level: number, elapsedMs = 60_000, firstTry = true) => ({
  level,
  elapsedMs,
  firstTry,
});

describe('ProgressStore', () => {
  it('starts at level 1 with no streak', () => {
    const progress = new ProgressStore(new MemoryStore());
    expect(progress.progress).toEqual(INITIAL_PROGRESS);
    expect(progress.bestTime(1)).toBeUndefined();
  });

  it('advances the path on a win and never moves it back on a replay', () => {
    const progress = new ProgressStore(new MemoryStore());
    progress.recordWin(win(1));
    expect(progress.progress.currentLevel).toBe(2);
    progress.recordWin(win(2));
    progress.recordWin(win(3));
    expect(progress.progress.currentLevel).toBe(4);
    expect(progress.recordWin(win(1)).replay).toBe(true);
    expect(progress.progress.currentLevel).toBe(4);
  });

  it('keeps the best time of each level and says when it is beaten', () => {
    const progress = new ProgressStore(new MemoryStore());
    expect(progress.recordWin(win(1, 50_000))).toMatchObject({
      bestMs: 50_000,
      previousBestMs: undefined,
      newBest: false,
    });
    expect(progress.recordWin(win(1, 70_000))).toMatchObject({
      bestMs: 50_000,
      previousBestMs: 50_000,
      newBest: false,
    });
    expect(progress.recordWin(win(1, 50_000))).toMatchObject({ bestMs: 50_000, newBest: false });
    expect(progress.recordWin(win(1, 40_400.6))).toMatchObject({ bestMs: 40_401, newBest: true });
    expect(progress.bestTime(1)).toBe(40_401);
    expect(progress.bestTime(2)).toBeUndefined();
  });

  it('counts first-try wins on new levels and ends the streak on a loss', () => {
    const progress = new ProgressStore(new MemoryStore());
    expect(progress.recordWin(win(1)).streak).toBe(1);
    expect(progress.recordWin(win(2)).streak).toBe(2);
    expect(progress.recordLoss(3).streak).toBe(0);
    expect(progress.progress.bestStreak).toBe(2);
    // The retry that wins level 3 is not a first try.
    expect(progress.recordWin(win(3, 60_000, false))).toMatchObject({ streak: 0, firstTry: false });
    expect(progress.recordWin(win(4)).streak).toBe(1);
    expect(progress.progress.bestStreak).toBe(2);
  });

  it('leaves the streak alone on replays, won or lost', () => {
    const progress = new ProgressStore(new MemoryStore());
    progress.recordWin(win(1));
    progress.recordWin(win(2));
    expect(progress.recordWin(win(1))).toMatchObject({ replay: true, streak: 2 });
    expect(progress.recordWin(win(1, 60_000, false))).toMatchObject({ replay: true, streak: 2 });
    expect(progress.recordLoss(2)).toMatchObject({ streak: 2, lostLevels: [] });
    expect(progress.recordWin(win(3)).streak).toBe(3);
  });

  it('does not count a level lost before a reload as a first try when it is won', () => {
    const store = new MemoryStore();
    new ProgressStore(store).recordLoss(5);
    // The player left and came back: the screen sees a fresh board.
    const progress = new ProgressStore(store);
    expect(progress.recordWin(win(5))).toMatchObject({ firstTry: false, streak: 0 });
    expect(progress.progress.lostLevels).toEqual([]);
    // The next level is a first try again.
    expect(progress.recordWin(win(6))).toMatchObject({ firstTry: true, streak: 1 });
  });

  it('remembers every lost level until it is won', () => {
    const progress = new ProgressStore(new MemoryStore());
    progress.recordLoss(5);
    progress.recordLoss(4);
    progress.recordLoss(5);
    expect(progress.progress.lostLevels).toEqual([5, 4]);
    expect(progress.recordWin(win(2)).firstTry).toBe(true);
    expect(progress.recordWin(win(5)).firstTry).toBe(false);
    expect(progress.recordWin(win(4)).firstTry).toBe(false);
    expect(progress.progress.lostLevels).toEqual([]);
  });

  it('survives a reload', () => {
    const store = new MemoryStore();
    const first = new ProgressStore(store);
    first.recordWin(win(1, 30_000));
    first.recordWin(win(2, 45_000));
    const again = new ProgressStore(store);
    expect(again.progress).toEqual(first.progress);
    expect(again.progress.currentLevel).toBe(3);
    expect(again.bestTime(2)).toBe(45_000);
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!)).toMatchObject({ version: 1, streak: 2 });
  });

  it('never writes an out-of-date copy over progress another page saved', () => {
    const store = new MemoryStore();
    // Two tabs, or a page the browser kept in its back-forward cache.
    const old = new ProgressStore(store);
    const current = new ProgressStore(store);
    expect(old.progress.currentLevel).toBe(1);
    current.recordWin(win(1, 1000));
    current.recordWin(win(2, 2000));
    old.recordWin(win(1, 28_000));
    expect(old.progress).toMatchObject({
      currentLevel: 3,
      bestTimes: { '1': 1000, '2': 2000 },
      streak: 2,
    });
    old.recordLoss(3);
    expect(current.progress).toMatchObject({ currentLevel: 3, streak: 0, lostLevels: [3] });
  });

  it('leaves a newer build’s record as it is and plays on in memory', () => {
    const store = new MemoryStore();
    const newer = JSON.stringify({ version: 2, levels: { current: 80 } });
    store.setItem(PROGRESS_KEY, newer);
    const progress = new ProgressStore(store);
    expect(progress.progress).toEqual(INITIAL_PROGRESS);
    progress.recordWin(win(1));
    expect(progress.progress.currentLevel).toBe(2);
    expect(store.getItem(PROGRESS_KEY)).toBe(newer);
  });
});

describe('parseProgress', () => {
  it('reads what the store writes', () => {
    const stored = {
      version: 1,
      currentLevel: 42,
      bestTimes: { '1': 30_000, '41': 95_000 },
      streak: 6,
      bestStreak: 9,
      lostLevels: [42],
    };
    expect(parseProgress(JSON.stringify(stored))).toEqual(stored);
  });

  it('starts over on nothing, broken JSON, a non-object or another version', () => {
    for (const raw of [null, '', '{', 'null', '42', '"text"', '[]', '{"version":2}', '{}']) {
      expect(parseProgress(raw), String(raw)).toEqual(INITIAL_PROGRESS);
    }
  });

  it('drops bad fields one by one and keeps the good ones', () => {
    const parsed = parseProgress(
      JSON.stringify({
        version: 1,
        currentLevel: 0,
        bestTimes: { '3': 1000, '0': 5, x: 7, '04': 9, '5': -1, '6': 1.5, '7': '8' },
        streak: 4,
        bestStreak: 'many',
        lostLevels: [3, 0, -2, 'x', 3, 1.5, 9],
      }),
    );
    expect(parsed).toEqual({
      version: 1,
      currentLevel: 1,
      bestTimes: { '3': 1000 },
      streak: 4,
      bestStreak: 4,
      lostLevels: [3, 9],
    });
    expect(parseProgress('{"version":1,"bestTimes":[1,2]}').bestTimes).toEqual({});
    expect(parseProgress('{"version":1,"lostLevels":{"0":3}}').lostLevels).toEqual([]);
    // The best streak is never below the current one.
    expect(parseProgress('{"version":1,"streak":5,"bestStreak":3}').bestStreak).toBe(5);
  });
});

describe('isNewerRecord', () => {
  it('is true only for a record with a higher version', () => {
    expect(isNewerRecord('{"version":2}')).toBe(true);
    for (const raw of [null, '', '{', '{"version":1}', '{"version":"2"}', '{}', '[2]']) {
      expect(isNewerRecord(raw), String(raw)).toBe(false);
    }
  });
});
