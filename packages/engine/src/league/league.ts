import { createRng } from '../rng/rng.ts';
import { characterNames } from './names.ts';

export const LEAGUES = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'Legend',
] as const;
export type LeagueName = (typeof LEAGUES)[number];

export const LEAGUE_SIZE = 30;
export const PROMOTED = 10;
export const RELEGATED = 10;
export const SECONDS_PER_DAY = 86_400;

/**
 * Median daily points of the characters in Bronze, in `scoreBoard` units
 * (a medium 120-cell board at par is 120). Each league up multiplies it.
 */
export const BRONZE_MEDIAN = 350;
export const LEAGUE_STEP = 1.3;
/** Log-normal spread of character strength within a league. */
export const SKILL_SPREAD = 0.7;

/**
 * A character in the table: not a person, and labelled as such in the UI.
 * Its day is simulated: `total` points arrive in `sessions`, each a burst
 * centred on a time of day, so the table moves while the player is away.
 */
export interface Character {
  readonly kind: 'character';
  readonly id: string;
  readonly name: string;
  /** Index into the avatar set the designer produces. */
  readonly avatar: number;
  /** Points by the end of the day. */
  readonly total: number;
  readonly sessions: readonly Session[];
}

export interface Session {
  /** Centre of the burst, seconds of the day. */
  readonly at: number;
  /** Share of `total` this burst delivers. Shares sum to 1. */
  readonly share: number;
  /** How long the burst takes, seconds. */
  readonly duration: number;
}

export interface Season {
  readonly league: number;
  readonly dayKey: string;
  readonly characters: readonly Character[];
}

export const AVATAR_COUNT = 24;

/** The 29 characters of a league for a day. Same day and league, same table, everywhere. */
export function generateSeason(league: number, dayKey: string): Season {
  if (!Number.isInteger(league) || league < 0 || league >= LEAGUES.length) {
    throw new RangeError(`League index out of range: ${league}`);
  }
  const rng = createRng(`league:${league}:${dayKey}`);
  const names = characterNames(rng.fork('names'), LEAGUE_SIZE - 1);
  const median = leagueMedian(league);
  const characters = names.map((name, i): Character => {
    const own = rng.fork(`character:${i}`);
    const total = Math.round(median * Math.exp(SKILL_SPREAD * own.normal()));
    const sessionCount = 1 + own.int(4);
    const weights = Array.from({ length: sessionCount }, () => 0.5 + own.next());
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const sessions = weights
      .map((weight): Session => ({
        // Mostly morning, lunch and evening, with some noise.
        at: Math.round(own.pick([8, 12.5, 18, 21]) * 3600 + own.normal() * 2400),
        share: weight / weightSum,
        duration: 900 + own.int(2700),
      }))
      .map((session) => ({
        ...session,
        at: Math.min(SECONDS_PER_DAY - 1, Math.max(0, session.at)),
      }))
      .sort((a, b) => a.at - b.at);
    return {
      kind: 'character',
      id: `c${league}-${dayKey}-${i}`,
      name,
      avatar: own.int(AVATAR_COUNT),
      total,
      sessions,
    };
  });
  return { league, dayKey, characters };
}

export function leagueMedian(league: number): number {
  return BRONZE_MEDIAN * LEAGUE_STEP ** league;
}

/** A character's points at a time of day: the sum of its bursts so far, each a smooth ramp. */
export function characterScoreAt(character: Character, secondsOfDay: number): number {
  let score = 0;
  for (const session of character.sessions) {
    const start = session.at - session.duration / 2;
    const progress = Math.min(1, Math.max(0, (secondsOfDay - start) / session.duration));
    score += character.total * session.share * progress;
  }
  return Math.round(score);
}

export interface Row {
  readonly rank: number;
  readonly kind: 'player' | 'character';
  readonly id: string;
  readonly name: string;
  readonly avatar: number;
  readonly score: number;
}

export interface PlayerEntry {
  readonly id: string;
  readonly name: string;
  readonly avatar: number;
  readonly score: number;
}

/** The table at a time of day, best first. Ties go to the player, then to the earlier id. */
export function standings(season: Season, player: PlayerEntry, secondsOfDay: number): Row[] {
  const rows: Omit<Row, 'rank'>[] = [
    {
      kind: 'player',
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
    },
    ...season.characters.map((character) => ({
      kind: character.kind,
      id: character.id,
      name: character.name,
      avatar: character.avatar,
      score: characterScoreAt(character, secondsOfDay),
    })),
  ];
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      (a.kind === 'player' ? -1 : b.kind === 'player' ? 1 : a.id < b.id ? -1 : 1),
  );
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export type DayOutcome = 'promoted' | 'stayed' | 'relegated';

/** What happens to the player at the end of the day, from the final table. */
export function resolveDay(rows: readonly Row[], league: number): DayOutcome {
  const rank = rows.find((row) => row.kind === 'player')?.rank;
  if (rank === undefined) throw new Error('The player is not in the table');
  if (rank <= PROMOTED && league < LEAGUES.length - 1) return 'promoted';
  if (rank > LEAGUE_SIZE - RELEGATED && league > 0) return 'relegated';
  return 'stayed';
}

/** The league the player is in after the day's outcome. */
export function nextLeague(league: number, outcome: DayOutcome): number {
  if (outcome === 'promoted') return Math.min(LEAGUES.length - 1, league + 1);
  if (outcome === 'relegated') return Math.max(0, league - 1);
  return league;
}
