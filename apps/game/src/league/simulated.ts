import {
  generateSeason,
  LEAGUE_SIZE,
  LEAGUES,
  nextLeague,
  PROMOTED,
  RELEGATED,
  resolveDay,
  scoreBoard,
  SECONDS_PER_DAY,
  standings,
} from '@arrows/engine';
import type { PlayerEntry, Row } from '@arrows/engine';
import type { DateKey } from '../daily/days.ts';
import { localDateKey, msUntilMidnight, secondsOfDay } from '../daily/days.ts';
import type { LeagueState } from '../persistence/league.ts';
import { LeagueStore } from '../persistence/league.ts';
import type { KeyValueStore } from '../persistence/store.ts';
import type {
  BoardAward,
  DaySummary,
  FinishedBoard,
  LeagueProvider,
  LeagueRow,
  LeagueView,
  Zone,
} from './provider.ts';

export const PLAYER_ID = 'player';

/** The table with the player last and staying put: they have not joined today yet. */
function waiting(rows: readonly LeagueRow[], league: number): LeagueRow[] {
  const characters = rows.filter((row) => row.kind === 'character');
  const player = rows.find((row) => row.kind === 'player')!;
  return [
    ...characters.map((row, i) => ({ ...row, rank: i + 1, zone: zoneOf(i + 1, league) })),
    { ...player, rank: LEAGUE_SIZE, zone: 'stay' as const },
  ];
}

function player(points: number, name: string): PlayerEntry {
  return { id: PLAYER_ID, name, avatar: -1, score: points };
}

function zoneOf(rank: number, league: number): Zone {
  if (rank <= PROMOTED && league < LEAGUES.length - 1) return 'up';
  if (rank > LEAGUE_SIZE - RELEGATED && league > 0) return 'down';
  return 'stay';
}

/**
 * The league played against the game's characters, on the device: the
 * engine's `generateSeason` gives the day's 29 characters, `standings` the
 * table at a time of day, `resolveDay` the move at midnight. Nothing but the
 * player's own state is stored.
 */
export class SimulatedLeagueProvider implements LeagueProvider {
  private readonly store: LeagueStore;
  private readonly playerName: string;

  constructor(store: KeyValueStore, playerName: string) {
    this.store = new LeagueStore(store);
    this.playerName = playerName;
  }

  view(now: Date): LeagueView {
    const state = this.today(now);
    const day = state.day!;
    const joined = state.boards.length > 0;
    const table = this.table(state.league, day, state.points, secondsOfDay(now));
    // Until a board is won today the player is not in today's table: below every
    // character, even those still at 0, and moving nowhere (docs/PRODUCT.md).
    const rows = joined ? table : waiting(table, state.league);
    const league = state.league;
    return {
      day,
      league,
      name: LEAGUES[league]!,
      rows,
      player: rows.find((row) => row.kind === 'player')!,
      joined,
      msUntilReset: msUntilMidnight(now),
      up: league < LEAGUES.length - 1 ? LEAGUES[league + 1]! : null,
      down: league > 0 ? LEAGUES[league - 1]! : null,
    };
  }

  record(board: FinishedBoard, now: Date): BoardAward | null {
    const state = this.today(now);
    if (state.boards.includes(board.key)) return null;
    const points = scoreBoard({
      tier: board.tier,
      cellCount: board.cellCount,
      timeSeconds: board.timeSeconds,
      mistakes: board.chancesLost,
      event: board.event,
    });
    this.store.save({
      ...state,
      points: state.points + points,
      boards: [...state.boards, board.key],
    });
    const view = this.view(now);
    return { points, league: view.name, rank: view.player.rank };
  }

  summary(now: Date): DaySummary | null {
    return this.today(now).summary;
  }

  dismissSummary(): void {
    const state = this.store.state;
    if (state.summary !== null) this.store.save({ ...state, summary: null });
  }

  private table(league: number, day: DateKey, points: number, seconds: number): LeagueRow[] {
    const rows: Row[] = standings(
      generateSeason(league, day),
      player(points, this.playerName),
      seconds,
    );
    return rows.map((row) => ({ ...row, zone: zoneOf(row.rank, league) }));
  }

  /**
   * The state for today. On the first call of a new day, the last day played
   * is settled with its final table and its summary kept for the player; a day
   * without a board won changes nothing, and neither do days missed between.
   */
  private today(now: Date): LeagueState {
    const today = localDateKey(now);
    const state = this.store.state;
    if (state.day === today) return state;
    let { league, summary } = state;
    // A day before today with a board won is settled. A stored day after today
    // (the clock was set back) is dropped unsettled: its points came from a clock
    // that was ahead.
    if (state.day !== null && state.day < today && state.boards.length > 0) {
      const rows = this.table(league, state.day, state.points, SECONDS_PER_DAY);
      const outcome = resolveDay(rows, league);
      const rank = rows.find((row) => row.kind === 'player')!.rank;
      summary = { day: state.day, league, rank, points: state.points, outcome };
      league = nextLeague(league, outcome);
    }
    const next: LeagueState = { ...state, league, day: today, points: 0, boards: [], summary };
    this.store.save(next);
    return next;
  }
}
