import { generateSeason, LEAGUES, scoreBoard } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { LEAGUE_KEY, LeagueStore } from '../persistence/league.ts';
import { MemoryStore } from '../persistence/store.ts';
import type { FinishedBoard } from './provider.ts';
import { SimulatedLeagueProvider } from './simulated.ts';

/** Local time on a day, as the device's clock gives it. */
const at = (day: string, hours = 12, minutes = 0): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d, hours, minutes);
};

/** A board worth far more than any character's day: first place. */
const big = (key = 'level:900'): FinishedBoard => ({
  key,
  tier: 'superHard',
  cellCount: 2000,
  timeSeconds: 1,
  chancesLost: 0,
  event: false,
});

/** A board worth a handful of points: last place. */
const tiny = (key = 'level:1'): FinishedBoard => ({
  key,
  tier: 'easy',
  cellCount: 6,
  timeSeconds: 600,
  chancesLost: 3,
  event: false,
});

function mount(store = new MemoryStore()): { league: SimulatedLeagueProvider; store: MemoryStore } {
  return { league: new SimulatedLeagueProvider(store, 'You'), store };
}

describe('SimulatedLeagueProvider', () => {
  it('starts in Bronze, at the bottom, with the day’s 29 characters', () => {
    const { league } = mount();
    const view = league.view(at('2026-10-14', 9));
    expect(view.name).toBe('Bronze');
    expect(view.day).toBe('2026-10-14');
    expect(view.joined).toBe(false);
    expect(view.rows).toHaveLength(30);
    expect(view.player).toMatchObject({ kind: 'player', name: 'You', score: 0 });
    const names = new Set(generateSeason(0, '2026-10-14').characters.map((c) => c.name));
    expect(
      view.rows.filter((row) => row.kind === 'character').every((r) => names.has(r.name)),
    ).toBe(true);
    // Bronze: the top ten move up, nobody moves down.
    expect(view.up).toBe('Silver');
    expect(view.down).toBeNull();
    expect(view.rows.map((row) => row.zone).filter((zone) => zone === 'up')).toHaveLength(10);
    expect(view.rows.some((row) => row.zone === 'down')).toBe(false);
  });

  it('moves the characters during the day', () => {
    const { league } = mount();
    const morning = league.view(at('2026-10-14', 6)).rows.reduce((sum, row) => sum + row.score, 0);
    const night = league
      .view(at('2026-10-14', 23, 59))
      .rows.reduce((sum, row) => sum + row.score, 0);
    expect(night).toBeGreaterThan(morning);
  });

  it('counts the reset to local midnight', () => {
    const { league } = mount();
    expect(league.view(at('2026-10-14', 23)).msUntilReset).toBe(3_600_000);
    expect(league.view(at('2026-10-14', 0)).msUntilReset).toBe(86_400_000);
  });

  it('scores each board once a day and ranks the player', () => {
    const { league } = mount();
    const now = at('2026-10-14', 20);
    const board = big();
    const award = league.record(board, now)!;
    expect(award.points).toBe(
      scoreBoard({ tier: 'superHard', cellCount: 2000, timeSeconds: 1, mistakes: 0, event: false }),
    );
    expect(award).toMatchObject({ league: 'Bronze', rank: 1 });
    // The same board again the same day earns nothing.
    expect(league.record(board, now)).toBeNull();
    const view = league.view(now);
    expect(view.joined).toBe(true);
    expect(view.player.score).toBe(award.points);
    // Another board adds up; the same board the next day counts again.
    expect(league.record(tiny(), now)!.points).toBeGreaterThan(0);
    expect(league.record(board, at('2026-10-15', 9))).not.toBeNull();
  });

  it('moves up after a winning day, and says so once', () => {
    const { league, store } = mount();
    league.record(big(), at('2026-10-14', 20));
    const next = at('2026-10-15', 8);
    const summary = league.summary(next);
    expect(summary).toMatchObject({ day: '2026-10-14', league: 0, rank: 1, outcome: 'promoted' });
    expect(league.view(next)).toMatchObject({ name: 'Silver', joined: false, day: '2026-10-15' });
    expect(league.view(next).player.score).toBe(0);
    // Until it is seen, the summary survives a reload.
    expect(new SimulatedLeagueProvider(store, 'You').summary(next)).toEqual(summary);
    league.dismissSummary();
    expect(league.summary(next)).toBeNull();
    expect(new SimulatedLeagueProvider(store, 'You').view(next).name).toBe('Silver');
  });

  it('settles only the last day played across several missed days', () => {
    const { league } = mount();
    league.record(big(), at('2026-10-10', 21));
    // Back five days later: one move up, not five.
    const back = at('2026-10-15', 9);
    expect(league.summary(back)).toMatchObject({ day: '2026-10-10', outcome: 'promoted' });
    expect(league.view(back).name).toBe('Silver');
  });

  it('leaves the league alone after a day without a board won', () => {
    const { league, store } = mount();
    new LeagueStore(store).save({
      version: 1,
      league: 3,
      day: '2026-10-13',
      points: 0,
      boards: [],
      summary: null,
    });
    const view = league.view(at('2026-10-14'));
    expect(view.name).toBe('Platinum');
    expect(league.summary(at('2026-10-14'))).toBeNull();
  });

  it('moves down from a poor day, but never below Bronze or above Legend', () => {
    const { league, store } = mount();
    const seed = (index: number) =>
      new LeagueStore(store).save({
        version: 1,
        league: index,
        day: null,
        points: 0,
        boards: [],
        summary: null,
      });
    seed(2);
    league.record(tiny(), at('2026-10-14', 23));
    expect(league.summary(at('2026-10-15'))).toMatchObject({ league: 2, outcome: 'relegated' });
    expect(league.view(at('2026-10-15')).name).toBe('Silver');

    seed(0);
    league.record(tiny(), at('2026-10-16', 23));
    expect(league.summary(at('2026-10-17'))).toMatchObject({ outcome: 'stayed' });
    expect(league.view(at('2026-10-17')).name).toBe('Bronze');

    // Top ten in Legend: nowhere higher to go.
    seed(LEAGUES.length - 1);
    league.record(big(), at('2026-10-18', 23));
    const top = league.summary(at('2026-10-19'))!;
    expect(top.rank).toBeLessThanOrEqual(10);
    expect(top.outcome).toBe('stayed');
    expect(league.view(at('2026-10-19'))).toMatchObject({ name: 'Legend', up: null });
  });

  it('drops a day stored ahead of the clock without settling it', () => {
    const { league, store } = mount();
    league.record(big(), at('2026-10-20', 12));
    // The clock goes back to the 14th.
    const view = league.view(at('2026-10-14', 12));
    expect(view).toMatchObject({ name: 'Bronze', day: '2026-10-14', joined: false });
    expect(league.summary(at('2026-10-14'))).toBeNull();
    expect(JSON.parse(store.getItem(LEAGUE_KEY)!)).toMatchObject({ day: '2026-10-14', points: 0 });
  });
});
