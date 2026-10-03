import { describe, expect, it } from 'vitest';
import { INITIAL_PROGRESS, parseProgress, PROGRESS_KEY, ProgressStore } from './progress.ts';
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
    progress.recordWin(win(1));
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

  it('counts first-try wins and ends the streak on a loss', () => {
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

  it('does not count a level lost before a reload as a first try when it is won', () => {
    const store = new MemoryStore();
    new ProgressStore(store).recordLoss(5);
    // The player left and came back: the screen sees a fresh board.
    const progress = new ProgressStore(store);
    expect(progress.recordWin(win(5))).toMatchObject({ firstTry: false, streak: 0 });
    expect(progress.progress.lostLevel).toBeNull();
    // The next level is a first try again.
    expect(progress.recordWin(win(6))).toMatchObject({ firstTry: true, streak: 1 });
  });

  it('keeps the lost level through wins on other levels', () => {
    const progress = new ProgressStore(new MemoryStore());
    progress.recordLoss(5);
    expect(progress.recordWin(win(2)).firstTry).toBe(true);
    expect(progress.recordWin(win(5)).firstTry).toBe(false);
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
});

describe('parseProgress', () => {
  it('reads what the store writes', () => {
    const stored = {
      version: 1,
      currentLevel: 42,
      bestTimes: { '1': 30_000, '41': 95_000 },
      streak: 6,
      bestStreak: 9,
      lostLevel: null,
    };
    expect(parseProgress(JSON.stringify(stored))).toEqual(stored);
  });

  it('starts over on nothing, broken JSON, a non-object or an unknown version', () => {
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
        lostLevel: -2,
      }),
    );
    expect(parsed).toEqual({
      version: 1,
      currentLevel: 1,
      bestTimes: { '3': 1000 },
      streak: 4,
      bestStreak: 4,
      lostLevel: null,
    });
    expect(parseProgress('{"version":1,"bestTimes":[1,2]}').bestTimes).toEqual({});
    // The best streak is never below the current one.
    expect(parseProgress('{"version":1,"streak":5,"bestStreak":3}').bestStreak).toBe(5);
  });
});
