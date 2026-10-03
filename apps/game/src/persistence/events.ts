import type { GameEvent } from '../events/catalog.ts';
import { readJson, RecordSlot } from './record.ts';
import type { KeyValueStore } from './store.ts';

export const EVENTS_KEY = 'arrows.events';
export const EVENTS_VERSION = 1;

/** The boards won in each event, by event id, as 1-based board numbers. */
export interface EventResults {
  readonly version: typeof EVENTS_VERSION;
  readonly events: Readonly<Record<string, readonly number[]>>;
}

export const INITIAL_EVENTS: EventResults = { version: EVENTS_VERSION, events: {} };

const isBoardNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

/** Reads stored event results; each event's list keeps only whole board numbers, once each. */
export function parseEventResults(raw: string | null): EventResults {
  const record = readJson(raw);
  if (record?.version !== EVENTS_VERSION) return INITIAL_EVENTS;
  const events: Record<string, number[]> = {};
  const stored = record.events;
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    for (const [id, won] of Object.entries(stored as Record<string, unknown>)) {
      if (Array.isArray(won))
        events[id] = [...new Set(won.filter(isBoardNumber))].sort((a, b) => a - b);
    }
  }
  return { version: EVENTS_VERSION, events };
}

/** How far a player got in an event. */
export interface EventProgress {
  /** Board numbers won, in order. */
  readonly won: readonly number[];
  readonly total: number;
  /** The board to play next (the first not won), or null when every board is won. */
  readonly next: number | null;
  /** Every board won: the event's badge. */
  readonly complete: boolean;
}

export interface EventWin {
  readonly progress: EventProgress;
  /** This win was the board's first. */
  readonly first: boolean;
  /** This win completed the event: the badge was earned just now. */
  readonly badge: boolean;
}

export class EventStore {
  private readonly slot: RecordSlot<EventResults>;

  constructor(store: KeyValueStore) {
    this.slot = new RecordSlot(
      store,
      EVENTS_KEY,
      EVENTS_VERSION,
      parseEventResults,
      INITIAL_EVENTS,
    );
  }

  progress(event: GameEvent): EventProgress {
    const total = event.boards.length;
    const won = (this.slot.read().events[event.id] ?? []).filter((n) => n <= total);
    // Sorted and once each (parseEventResults), so the first gap is the next board.
    const gap = won.findIndex((n, i) => n !== i + 1);
    const first = gap === -1 ? won.length + 1 : gap + 1;
    const next = first <= total ? first : null;
    return { won, total, next, complete: won.length === total };
  }

  /** Stores a board won. The app opens only boards up to the next, so the order holds. */
  recordWin(event: GameEvent, board: number): EventWin {
    const before = this.progress(event);
    const first = !before.won.includes(board);
    if (!first) return { progress: before, first, badge: false };
    const results = this.slot.read();
    const won = [...before.won, board].sort((a, b) => a - b);
    this.slot.write({ ...results, events: { ...results.events, [event.id]: won } });
    const progress = this.progress(event);
    return { progress, first, badge: progress.complete && !before.complete };
  }
}
