import { describe, expect, it } from 'vitest';
import { isCount, isNewerRecord, readJson, RecordSlot } from './record.ts';
import { MemoryStore } from './store.ts';

describe('readJson', () => {
  it('reads a stored object and nothing else', () => {
    expect(readJson('{"a":1}')).toEqual({ a: 1 });
    for (const raw of [null, '', '{', 'null', '42', '"text"', '[1]']) {
      expect(readJson(raw), String(raw)).toBeNull();
    }
  });
});

describe('isCount', () => {
  it('takes whole numbers from zero', () => {
    expect([0, 1, 90_000].every(isCount)).toBe(true);
    expect([-1, 1.5, Number.NaN, Infinity, '3', null].some(isCount)).toBe(false);
  });
});

describe('isNewerRecord', () => {
  it('is true only for a record with a higher version', () => {
    expect(isNewerRecord('{"version":2}', 1)).toBe(true);
    for (const raw of [null, '', '{', '{"version":1}', '{"version":"2"}', '{}', '[2]']) {
      expect(isNewerRecord(raw, 1), String(raw)).toBe(false);
    }
  });
});

describe('RecordSlot', () => {
  const parse = (raw: string | null): { version: 1; n: number } => {
    const n = readJson(raw)?.n;
    return { version: 1, n: isCount(n) ? n : 0 };
  };

  it('reads the store every time, so it sees what others wrote', () => {
    const store = new MemoryStore();
    const a = new RecordSlot(store, 'k', 1, parse, { version: 1, n: 0 });
    const b = new RecordSlot(store, 'k', 1, parse, { version: 1, n: 0 });
    a.write({ version: 1, n: 5 });
    expect(b.read().n).toBe(5);
  });

  it('never overwrites a newer build’s record and keeps its own changes in memory', () => {
    const store = new MemoryStore();
    store.setItem('k', '{"version":2,"m":9}');
    const slot = new RecordSlot(store, 'k', 1, parse, { version: 1, n: 0 });
    expect(slot.read()).toEqual({ version: 1, n: 0 });
    slot.write({ version: 1, n: 3 });
    expect(slot.read()).toEqual({ version: 1, n: 3 });
    expect(store.getItem('k')).toBe('{"version":2,"m":9}');
  });
});
