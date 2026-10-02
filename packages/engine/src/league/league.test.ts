import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng.ts';
import {
  LEAGUES,
  LEAGUE_SIZE,
  SECONDS_PER_DAY,
  characterScoreAt,
  generateSeason,
  leagueMedian,
  nextLeague,
  resolveDay,
  standings,
} from './league.ts';
import { ADJECTIVES, NOUNS, characterNames } from './names.ts';
import { scoreBoard } from './scoring.ts';

const player = { id: 'me', name: 'You', avatar: 0, score: 500 };

describe('generateSeason', () => {
  it('is the same table for the same league and day, everywhere', () => {
    const a = generateSeason(0, '2026-10-02');
    const b = generateSeason(0, '2026-10-02');
    expect(a).toEqual(b);
    expect(a.characters).toHaveLength(LEAGUE_SIZE - 1);
    expect(new Set(a.characters.map((c) => c.name)).size).toBe(LEAGUE_SIZE - 1);
    expect(generateSeason(0, '2026-10-03')).not.toEqual(a);
    expect(generateSeason(1, '2026-10-02')).not.toEqual(a);
  });

  it('rejects a league outside the ladder', () => {
    expect(() => generateSeason(-1, '2026-10-02')).toThrow(RangeError);
    expect(() => generateSeason(LEAGUES.length, '2026-10-02')).toThrow(RangeError);
  });

  it('gets stronger up the ladder', () => {
    const medianOf = (league: number): number => {
      const totals = generateSeason(league, '2026-10-02')
        .characters.map((c) => c.total)
        .sort((x, y) => x - y);
      return totals[Math.floor(totals.length / 2)]!;
    };
    expect(medianOf(3)).toBeGreaterThan(medianOf(0));
    expect(leagueMedian(6)).toBeGreaterThan(leagueMedian(5));
  });
});

describe('characterScoreAt', () => {
  it('starts near zero, never decreases and reaches the total by the end of the day', () => {
    for (const character of generateSeason(2, '2026-10-02').characters) {
      let previous = -1;
      for (let t = 0; t <= SECONDS_PER_DAY; t += 600) {
        const score = characterScoreAt(character, t);
        expect(score).toBeGreaterThanOrEqual(previous);
        previous = score;
      }
      expect(characterScoreAt(character, SECONDS_PER_DAY)).toBe(character.total);
      expect(characterScoreAt(character, 0)).toBeLessThan(character.total);
    }
  });
});

describe('standings and the day outcome', () => {
  it('ranks best first, the player winning ties', () => {
    const season = generateSeason(0, '2026-10-02');
    const rows = standings(season, player, SECONDS_PER_DAY);
    expect(rows).toHaveLength(LEAGUE_SIZE);
    rows.forEach((row, i) => {
      expect(row.rank).toBe(i + 1);
      if (i > 0) expect(row.score).toBeLessThanOrEqual(rows[i - 1]!.score);
    });
    const tied = season.characters[0]!.total;
    const tiedRows = standings(season, { ...player, score: tied }, SECONDS_PER_DAY);
    const me = tiedRows.find((row) => row.kind === 'player')!;
    const them = tiedRows.find((row) => row.id === season.characters[0]!.id)!;
    expect(me.rank).toBeLessThan(them.rank);
  });

  it('promotes the top 10, relegates the bottom 10, never below Bronze or above Legend', () => {
    const season = generateSeason(3, '2026-10-02');
    const top = standings(season, { ...player, score: 1_000_000 }, SECONDS_PER_DAY);
    const bottom = standings(season, { ...player, score: 0 }, SECONDS_PER_DAY);
    expect(resolveDay(top, 3)).toBe('promoted');
    expect(resolveDay(bottom, 3)).toBe('relegated');
    expect(resolveDay(bottom, 0)).toBe('stayed');
    expect(resolveDay(top, LEAGUES.length - 1)).toBe('stayed');
    expect(nextLeague(3, 'promoted')).toBe(4);
    expect(nextLeague(3, 'relegated')).toBe(2);
    expect(nextLeague(3, 'stayed')).toBe(3);
    expect(nextLeague(0, 'relegated')).toBe(0);
    expect(nextLeague(LEAGUES.length - 1, 'promoted')).toBe(LEAGUES.length - 1);
  });

  it('exact rank boundaries', () => {
    const season = generateSeason(2, '2026-10-02');
    const totals = season.characters.map((c) => c.total).sort((a, b) => b - a);
    // Just above the 10th character: rank 10. Just below: rank 11.
    const tenth = totals[9]!;
    expect(resolveDay(standings(season, { ...player, score: tenth + 1 }, SECONDS_PER_DAY), 2)).toBe(
      'promoted',
    );
    expect(resolveDay(standings(season, { ...player, score: tenth - 1 }, SECONDS_PER_DAY), 2)).toBe(
      'stayed',
    );
    const twentieth = totals[19]!;
    expect(
      resolveDay(standings(season, { ...player, score: twentieth + 1 }, SECONDS_PER_DAY), 2),
    ).toBe('stayed');
    expect(
      resolveDay(standings(season, { ...player, score: twentieth - 1 }, SECONDS_PER_DAY), 2),
    ).toBe('relegated');
  });
});

describe('characterNames', () => {
  it('builds distinct adjective-noun names from the lists', () => {
    const names = characterNames(createRng('names'), 50);
    expect(new Set(names).size).toBe(50);
    for (const name of names) {
      const [adjective, noun] = name.split(' ');
      expect(ADJECTIVES).toContain(adjective);
      expect(NOUNS).toContain(noun);
    }
    expect(() => characterNames(createRng('x'), ADJECTIVES.length * NOUNS.length + 1)).toThrow(
      RangeError,
    );
  });
});

describe('scoreBoard', () => {
  it('is the cell count for a medium board at par with no mistakes', () => {
    expect(scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 120, mistakes: 0 })).toBe(120);
  });

  it('rewards speed and tier, punishes mistakes, caps both ways', () => {
    const par = scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 120, mistakes: 0 });
    expect(
      scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 60, mistakes: 0 }),
    ).toBeGreaterThan(par);
    expect(scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 1, mistakes: 0 })).toBe(
      Math.round(120 * 1.4),
    );
    expect(scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 100_000, mistakes: 0 })).toBe(
      Math.round(120 * 0.6),
    );
    expect(scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 120, mistakes: 2 })).toBe(
      Math.round(120 * 0.7),
    );
    expect(scoreBoard({ tier: 'medium', cellCount: 120, timeSeconds: 120, mistakes: 9 })).toBe(
      Math.round(120 * 0.55),
    );
    expect(scoreBoard({ tier: 'superHard', cellCount: 120, timeSeconds: 120, mistakes: 0 })).toBe(
      240,
    );
    expect(
      scoreBoard({ tier: 'hard', cellCount: 120, timeSeconds: 120, mistakes: 0, event: true }),
    ).toBe(225);
  });
});
