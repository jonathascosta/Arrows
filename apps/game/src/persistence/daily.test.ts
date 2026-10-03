import { describe, expect, it } from 'vitest';
import { DAILY_KEY, DailyStore, INITIAL_DAILY, parseDailyResults } from './daily.ts';
import { MemoryStore } from './store.ts';

const TODAY = '2026-10-14';

describe('DailyStore', () => {
  it('starts with no day won', () => {
    const daily = new DailyStore(new MemoryStore());
    expect(daily.results).toEqual(INITIAL_DAILY);
    expect(daily.finished().size).toBe(0);
  });

  it('stores a won day with its best time, and survives a reload', () => {
    const store = new MemoryStore();
    const daily = new DailyStore(store);
    expect(daily.recordWin('2026-10-02', 95_000.4, TODAY)).toEqual({
      replay: false,
      bestMs: 95_000,
      previousBestMs: undefined,
      newBest: false,
      monthComplete: false,
    });
    expect(daily.recordWin('2026-10-02', 120_000, TODAY)).toMatchObject({
      replay: true,
      bestMs: 95_000,
      newBest: false,
    });
    expect(daily.recordWin('2026-10-02', 80_000, TODAY)).toMatchObject({
      replay: true,
      bestMs: 80_000,
      previousBestMs: 95_000,
      newBest: true,
    });
    const reloaded = new DailyStore(store);
    expect([...reloaded.finished()]).toEqual(['2026-10-02']);
    expect(reloaded.bestTime('2026-10-02')).toBe(80_000);
    expect(JSON.parse(store.getItem(DAILY_KEY)!)).toEqual({
      version: 1,
      days: { '2026-10-02': { bestMs: 80_000 } },
    });
  });

  it('says when a first win completes its month', () => {
    const daily = new DailyStore(new MemoryStore());
    for (let day = 1; day < 30; day++) {
      const win = daily.recordWin(`2026-09-${String(day).padStart(2, '0')}`, 1000, TODAY);
      expect(win.monthComplete).toBe(false);
    }
    expect(daily.recordWin('2026-09-30', 1000, TODAY).monthComplete).toBe(true);
    // A replay in a complete month earns nothing new.
    expect(daily.recordWin('2026-09-30', 900, TODAY).monthComplete).toBe(false);
  });

  it('never writes an out-of-date copy over another page’s results', () => {
    const store = new MemoryStore();
    const old = new DailyStore(store);
    const current = new DailyStore(store);
    current.recordWin('2026-10-01', 1000, TODAY);
    old.recordWin('2026-10-02', 2000, TODAY);
    expect([...current.finished()].sort()).toEqual(['2026-10-01', '2026-10-02']);
  });
});

describe('parseDailyResults', () => {
  it('keeps each valid day and drops the rest', () => {
    const parsed = parseDailyResults(
      JSON.stringify({
        version: 1,
        days: {
          '2026-10-02': { bestMs: 95_000 },
          '2026-02-30': { bestMs: 1000 },
          today: { bestMs: 1000 },
          '2026-10-03': { bestMs: -5 },
          '2026-10-04': { bestMs: '1000' },
          '2026-10-05': 1000,
          '2026-10-06': null,
        },
      }),
    );
    expect(parsed).toEqual({ version: 1, days: { '2026-10-02': { bestMs: 95_000 } } });
  });

  it('starts empty on nothing, broken JSON, another version or a bad shape', () => {
    for (const raw of [null, '{', '[]', '{"version":2,"days":{}}', '{"version":1,"days":[1]}']) {
      expect(parseDailyResults(raw), String(raw)).toEqual(INITIAL_DAILY);
    }
  });
});
