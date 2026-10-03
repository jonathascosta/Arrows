import { tierForLevel } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import type { DateKey } from '../daily/days.ts';
import type { StringKey } from '../strings.ts';

/** One board of an event: a drawing at a tier. Its seed is `board:event:<event id>:<number>`. */
export interface EventBoard {
  readonly drawingId: string;
  readonly tier: Tier;
}

/** A time-limited set of drawing boards (docs/PRODUCT.md, Events and championships). */
export interface GameEvent {
  readonly id: string;
  readonly name: StringKey;
  /** A short name for the line under a board's title: "Autumn · 3 of 6". */
  readonly short: StringKey;
  readonly badge: StringKey;
  /** First and last day, local dates, both included. */
  readonly start: DateKey;
  readonly end: DateKey;
  /** Played in order: the next opens when the one before is won. */
  readonly boards: readonly EventBoard[];
}

/** Boards in an event (docs/PRODUCT.md, Events and championships). */
export const EVENT_BOARDS = 300;

/**
 * An event's boards: its drawings in turn, the tiers in the levels' cycle of
 * ten (medium, medium, hard, medium, medium, medium, hard, medium, medium, super
 * hard), so board n has the tier of level 10 + n.
 */
export function eventBoards(
  drawingIds: readonly string[],
  count: number = EVENT_BOARDS,
): EventBoard[] {
  return Array.from({ length: count }, (_, i) => ({
    drawingId: drawingIds[i % drawingIds.length]!,
    tier: tierForLevel(10 + i + 1),
  }));
}

export const AUTUMN_2026: GameEvent = {
  id: 'autumn-2026',
  name: 'event.autumn2026',
  short: 'event.autumn2026.short',
  badge: 'event.autumn2026.badge',
  start: '2026-10-01',
  end: '2026-11-30',
  boards: eventBoards(['maple-leaf', 'acorn']),
};

export const EVENTS: readonly GameEvent[] = [AUTUMN_2026];

export function findEvent(id: string): GameEvent | undefined {
  return EVENTS.find((event) => event.id === id);
}

export type EventState = 'upcoming' | 'running' | 'ended';

export function eventState(event: GameEvent, today: DateKey): EventState {
  // Date keys compare as strings in calendar order.
  if (today < event.start) return 'upcoming';
  return today > event.end ? 'ended' : 'running';
}

/**
 * The event the home screen shows: the one running today, or else the one that
 * ended last, or none before the first event starts.
 */
export function eventOn(today: DateKey, events: readonly GameEvent[] = EVENTS): GameEvent | null {
  const running = events.find((event) => eventState(event, today) === 'running');
  if (running !== undefined) return running;
  const ended = events.filter((event) => eventState(event, today) === 'ended');
  return ended.reduce<GameEvent | null>(
    (latest, event) => (latest === null || event.end > latest.end ? event : latest),
    null,
  );
}

const dayNumber = (dateKey: DateKey): number => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d) / 86_400_000;
};

/** Days left in a running event, today included: 1 on its last day. */
export function daysLeft(event: GameEvent, today: DateKey): number {
  return Math.max(0, dayNumber(event.end) - dayNumber(today) + 1);
}
