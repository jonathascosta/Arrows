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

export const AUTUMN_2026: GameEvent = {
  id: 'autumn-2026',
  name: 'event.autumn2026',
  short: 'event.autumn2026.short',
  badge: 'event.autumn2026.badge',
  start: '2026-10-01',
  end: '2026-11-30',
  boards: [
    { drawingId: 'maple-leaf', tier: 'medium' },
    { drawingId: 'acorn', tier: 'medium' },
    { drawingId: 'maple-leaf', tier: 'hard' },
    { drawingId: 'acorn', tier: 'hard' },
    { drawingId: 'maple-leaf', tier: 'superHard' },
    { drawingId: 'acorn', tier: 'superHard' },
  ],
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
