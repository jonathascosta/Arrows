import { describe, expect, it } from 'vitest';
import { LEAGUES, SECONDS_PER_DAY, generateSeason, resolveDay, standings } from './league.ts';
import type { DayOutcome } from './league.ts';
import { scoreBoard } from './scoring.ts';

/**
 * The promotion bands the product document promises, over simulated days.
 * Runs with `pnpm test:calibration`.
 */
describe('league calibration', () => {
  const days = Array.from({ length: 120 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, 1 + i));
    return date.toISOString().slice(0, 10);
  });
  /** One medium board of 120 cells at par, no mistakes. */
  const board = scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 120, mistakes: 0 });

  const outcomes = (league: number, boardsPerDay: number): Record<DayOutcome, number> => {
    const counts: Record<DayOutcome, number> = { promoted: 0, stayed: 0, relegated: 0 };
    for (const dayKey of days) {
      const season = generateSeason(league, dayKey);
      const rows = standings(
        season,
        { id: 'me', name: 'You', avatar: 0, score: board * boardsPerDay },
        SECONDS_PER_DAY,
      );
      counts[resolveDay(rows, league)]++;
    }
    return counts;
  };
  const share = (counts: Record<DayOutcome, number>, outcome: DayOutcome): number =>
    counts[outcome] / days.length;

  it('8 medium boards a day climb Bronze and Silver almost every day', () => {
    expect(share(outcomes(0, 8), 'promoted')).toBeGreaterThan(0.9);
    expect(share(outcomes(1, 8), 'promoted')).toBeGreaterThan(0.8);
  });

  it('8 boards a day are not enough to climb out of Diamond, but hold it most days', () => {
    expect(share(outcomes(4, 8), 'promoted')).toBeLessThan(0.3);
    expect(share(outcomes(4, 8), 'relegated')).toBeLessThan(0.5);
  });

  it('20 boards a day hold Legend most days; 10 boards mostly fall', () => {
    const legend = LEAGUES.length - 1;
    expect(share(outcomes(legend, 20), 'relegated')).toBeLessThan(0.15);
    expect(share(outcomes(legend, 10), 'relegated')).toBeGreaterThan(0.6);
  });

  it('2 boards a day sink from Gold, and a day off is survivable in Bronze', () => {
    expect(share(outcomes(2, 2), 'relegated')).toBeGreaterThan(0.8);
    expect(outcomes(0, 0).relegated).toBe(0);
  });
});
