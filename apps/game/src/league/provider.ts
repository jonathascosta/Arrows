import type { DayOutcome, LeagueName, Tier } from '@arrows/engine';
import type { DateKey } from '../daily/days.ts';
import type { DaySummary } from '../persistence/league.ts';

/** Where a rank sits in the table: moving up, staying, or moving down at midnight. */
export type Zone = 'up' | 'stay' | 'down';

export interface LeagueRow {
  readonly rank: number;
  readonly kind: 'player' | 'character';
  readonly id: string;
  readonly name: string;
  /** Index into the theme's avatar colours. */
  readonly avatar: number;
  readonly score: number;
  readonly zone: Zone;
}

/** The table as the league screen shows it, at one moment. */
export interface LeagueView {
  readonly day: DateKey;
  readonly league: number;
  readonly name: LeagueName;
  readonly rows: readonly LeagueRow[];
  readonly player: LeagueRow;
  /** The player has won a board today, so today counts. */
  readonly joined: boolean;
  readonly msUntilReset: number;
  /** The leagues the top and the bottom move to, or null at either end of the ladder. */
  readonly up: LeagueName | null;
  readonly down: LeagueName | null;
}

/** A board won, as the league scores it (`scoreBoard`). */
export interface FinishedBoard {
  /** The same board has the same key: it counts once a day. */
  readonly key: string;
  readonly tier: Tier;
  readonly cellCount: number;
  readonly timeSeconds: number;
  readonly chancesLost: number;
  readonly event: boolean;
}

/** What a board earned: its points, and the player's league and rank after it. */
export interface BoardAward {
  readonly points: number;
  readonly league: LeagueName;
  readonly rank: number;
}

/**
 * The daily league, as the screens see it (docs/PRODUCT.md, Daily league).
 * The simulated provider plays the other 29 entries on the device; a provider
 * backed by a server can take its place when real players join.
 */
export interface LeagueProvider {
  /** The table now. Settles the last day played first if the date has moved on. */
  view(now: Date): LeagueView;
  /** Adds a board won now; null when it already counted today. */
  record(board: FinishedBoard, now: Date): BoardAward | null;
  /** The last day settled, until it has been seen. */
  summary(now: Date): DaySummary | null;
  dismissSummary(): void;
}

export type { DayOutcome };
