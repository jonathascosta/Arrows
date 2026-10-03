import { describe, expect, it } from 'vitest';
import { AUTUMN_2026 } from '../events/catalog.ts';
import { EVENTS_KEY, EventStore, INITIAL_EVENTS, parseEventResults } from './events.ts';
import { MemoryStore } from './store.ts';

describe('EventStore', () => {
  it('starts with nothing won and the first board next', () => {
    const events = new EventStore(new MemoryStore());
    expect(events.progress(AUTUMN_2026)).toEqual({ won: [], total: 6, next: 1, complete: false });
  });

  it('keeps every board won, and survives a reload', () => {
    const store = new MemoryStore();
    const events = new EventStore(store);
    expect(events.recordWin(AUTUMN_2026, 1)).toMatchObject({ first: true, badge: false });
    expect(events.recordWin(AUTUMN_2026, 1)).toMatchObject({ first: false, badge: false });
    events.recordWin(AUTUMN_2026, 2);
    expect(new EventStore(store).progress(AUTUMN_2026)).toEqual({
      won: [1, 2],
      total: 6,
      next: 3,
      complete: false,
    });
    expect(JSON.parse(store.getItem(EVENTS_KEY)!)).toEqual({
      version: 1,
      events: { 'autumn-2026': [1, 2] },
    });
  });

  it('earns the badge with the last board, once', () => {
    const events = new EventStore(new MemoryStore());
    for (let board = 1; board < 6; board++) {
      expect(events.recordWin(AUTUMN_2026, board).badge).toBe(false);
    }
    const last = events.recordWin(AUTUMN_2026, 6);
    expect(last).toMatchObject({ first: true, badge: true });
    expect(last.progress).toMatchObject({ next: null, complete: true });
    expect(events.recordWin(AUTUMN_2026, 6).badge).toBe(false);
  });

  it('never writes an out-of-date copy over another page’s progress', () => {
    const store = new MemoryStore();
    const old = new EventStore(store);
    new EventStore(store).recordWin(AUTUMN_2026, 1);
    old.recordWin(AUTUMN_2026, 2);
    expect(new EventStore(store).progress(AUTUMN_2026).won).toEqual([1, 2]);
  });
});

describe('parseEventResults', () => {
  it('keeps whole board numbers once each, and drops the rest', () => {
    expect(
      parseEventResults(
        JSON.stringify({
          version: 1,
          events: { 'autumn-2026': [2, 1, 2, 0, -1, 1.5, '3', 4], other: 'x' },
        }),
      ),
    ).toEqual({ version: 1, events: { 'autumn-2026': [1, 2, 4] } });
  });

  it('starts empty on nothing, broken JSON or another version', () => {
    for (const raw of [null, '{', '[]', '{"version":2,"events":{}}', '{"version":1,"events":[]}']) {
      expect(parseEventResults(raw), String(raw)).toEqual(INITIAL_EVENTS);
    }
  });

  it('ignores boards past the end of the event', () => {
    const store = new MemoryStore();
    store.setItem(EVENTS_KEY, JSON.stringify({ version: 1, events: { 'autumn-2026': [1, 9] } }));
    expect(new EventStore(store).progress(AUTUMN_2026)).toMatchObject({ won: [1], next: 2 });
  });
});
