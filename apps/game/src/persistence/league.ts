import { LEAGUES } from '@arrows/engine';
import type { DayOutcome } from '@arrows/engine';
import type { DateKey } from '../daily/days.ts';
import { isDateKey } from '../daily/days.ts';
import { isCount, readJson, RecordSlot } from './record.ts';
import type { KeyValueStore } from './store.ts';

export const LEAGUE_KEY = 'arrows.league';
export const LEAGUE_VERSION = 1;

/** How a day ended, shown once on the next day (docs/PRODUCT.md, Daily league). */
export interface DaySummary {
  readonly day: DateKey;
  /** The league the day was played in, as an index into `LEAGUES`. */
  readonly league: number;
  readonly rank: number;
  readonly points: number;
  readonly outcome: DayOutcome;
}

/** The player's place in the daily league. */
export interface LeagueState {
  readonly version: typeof LEAGUE_VERSION;
  /** Index into `LEAGUES`; every player starts in Bronze. */
  readonly league: number;
  /** The day the points belong to, or null before the first visit. */
  readonly day: DateKey | null;
  readonly points: number;
  /** The boards that earned points that day: each counts once a day. */
  readonly boards: readonly string[];
  /** The last day settled, until the player has seen it. */
  readonly summary: DaySummary | null;
}

export const INITIAL_LEAGUE: LeagueState = {
  version: LEAGUE_VERSION,
  league: 0,
  day: null,
  points: 0,
  boards: [],
  summary: null,
};

const OUTCOMES: readonly DayOutcome[] = ['promoted', 'stayed', 'relegated'];

const isLeague = (value: unknown): value is number => isCount(value) && value < LEAGUES.length;

function parseSummary(value: unknown): DaySummary | null {
  if (typeof value !== 'object' || value === null) return null;
  const summary = value as Record<string, unknown>;
  const { day, league, rank, points, outcome } = summary;
  if (
    typeof day !== 'string' ||
    !isDateKey(day) ||
    !isLeague(league) ||
    !isCount(rank) ||
    rank < 1 ||
    !isCount(points) ||
    !OUTCOMES.includes(outcome as DayOutcome)
  ) {
    return null;
  }
  return { day, league, rank, points, outcome: outcome as DayOutcome };
}

/**
 * Reads the stored league state. Nothing stored, broken JSON or another
 * version starts in Bronze; in a version 1 record each field falls back on its
 * own. A day whose points or boards are malformed starts that day over.
 */
export function parseLeagueState(raw: string | null): LeagueState {
  const record = readJson(raw);
  if (record?.version !== LEAGUE_VERSION) return INITIAL_LEAGUE;
  const league = isLeague(record.league) ? record.league : 0;
  const day = typeof record.day === 'string' && isDateKey(record.day) ? record.day : null;
  const boardsOk =
    Array.isArray(record.boards) && record.boards.every((board) => typeof board === 'string');
  const dayOk = day !== null && isCount(record.points) && boardsOk;
  return {
    version: LEAGUE_VERSION,
    league,
    day: dayOk ? day : null,
    points: dayOk ? (record.points as number) : 0,
    boards: dayOk ? [...new Set(record.boards as string[])] : [],
    summary: parseSummary(record.summary),
  };
}

export class LeagueStore {
  private readonly slot: RecordSlot<LeagueState>;

  constructor(store: KeyValueStore) {
    this.slot = new RecordSlot(store, LEAGUE_KEY, LEAGUE_VERSION, parseLeagueState, INITIAL_LEAGUE);
  }

  get state(): LeagueState {
    return this.slot.read();
  }

  save(state: LeagueState): void {
    this.slot.write(state);
  }
}
