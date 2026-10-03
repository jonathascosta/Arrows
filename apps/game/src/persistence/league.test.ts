import { describe, expect, it } from 'vitest';
import { INITIAL_LEAGUE, LEAGUE_KEY, LeagueStore, parseLeagueState } from './league.ts';
import { MemoryStore } from './store.ts';

const valid = {
  version: 1,
  league: 2,
  day: '2026-10-14',
  points: 512,
  boards: ['level:12', 'daily:2026-10-14'],
  summary: { day: '2026-10-13', league: 1, rank: 4, points: 900, outcome: 'promoted' },
};

describe('parseLeagueState', () => {
  it('reads what the store writes', () => {
    expect(parseLeagueState(JSON.stringify(valid))).toEqual(valid);
    const store = new MemoryStore();
    new LeagueStore(store).save(valid as typeof INITIAL_LEAGUE);
    expect(JSON.parse(store.getItem(LEAGUE_KEY)!)).toEqual(valid);
  });

  it('starts in Bronze on nothing, broken JSON or another version', () => {
    for (const raw of [null, '{', '[]', '{"version":2,"league":5}', '{}']) {
      expect(parseLeagueState(raw), String(raw)).toEqual(INITIAL_LEAGUE);
    }
  });

  it('keeps the league when the day is malformed, and drops a bad summary', () => {
    expect(parseLeagueState(JSON.stringify({ ...valid, points: -1 }))).toEqual({
      ...valid,
      day: null,
      points: 0,
      boards: [],
    });
    expect(parseLeagueState(JSON.stringify({ ...valid, boards: [1, 2] })).day).toBeNull();
    expect(parseLeagueState(JSON.stringify({ ...valid, day: '2026-02-30' })).day).toBeNull();
    expect(parseLeagueState(JSON.stringify({ ...valid, league: 7 })).league).toBe(0);
    expect(parseLeagueState(JSON.stringify({ ...valid, league: 1.5 })).league).toBe(0);
    for (const summary of [
      null,
      { ...valid.summary, outcome: 'won' },
      { ...valid.summary, rank: 0 },
      { ...valid.summary, day: 'yesterday' },
      { ...valid.summary, league: 9 },
    ]) {
      expect(parseLeagueState(JSON.stringify({ ...valid, summary })).summary).toBeNull();
    }
    expect(parseLeagueState(JSON.stringify({ ...valid, boards: ['a', 'a'] })).boards).toEqual([
      'a',
    ]);
  });
});
