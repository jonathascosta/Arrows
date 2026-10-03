import type { KeyValueStore } from './store.ts';

/** A whole number of zero or more, the way counts and milliseconds are stored. */
export const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** A stored JSON object, or null for nothing, broken JSON or any other value. */
export function readJson(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a stored record was written by a newer build. This build cannot read
 * it and must not overwrite it: going back to an older build (a TestFlight
 * downgrade) would otherwise lose what the newer one saved.
 */
export function isNewerRecord(raw: string | null, version: number): boolean {
  const stored = readJson(raw)?.version;
  return typeof stored === 'number' && stored > version;
}

/**
 * One versioned JSON record under one key. Every read goes to the store, so a
 * second tab, or a page the browser kept in its back-forward cache, never
 * writes an out-of-date copy over a newer one. A record from a newer build is
 * left alone; this build then keeps its changes in memory.
 */
export class RecordSlot<T> {
  private readonly store: KeyValueStore;
  private readonly key: string;
  private readonly version: number;
  private readonly parse: (raw: string | null) => T;
  private readonly initial: T;
  private detached: T | null = null;

  constructor(
    store: KeyValueStore,
    key: string,
    version: number,
    parse: (raw: string | null) => T,
    initial: T,
  ) {
    this.store = store;
    this.key = key;
    this.version = version;
    this.parse = parse;
    this.initial = initial;
  }

  read(): T {
    const raw = this.store.getItem(this.key);
    if (isNewerRecord(raw, this.version)) return this.detached ?? this.initial;
    return this.parse(raw);
  }

  write(value: T): void {
    if (isNewerRecord(this.store.getItem(this.key), this.version)) {
      this.detached = value;
      return;
    }
    this.store.setItem(this.key, JSON.stringify(value));
  }
}
