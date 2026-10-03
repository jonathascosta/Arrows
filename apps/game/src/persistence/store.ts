/**
 * Where the app keeps what it remembers between visits. The browser's
 * localStorage in the app, memory in tests; later the iOS Preferences plugin
 * (T8). Writes never throw: a full or blocked storage loses the write, not
 * the game.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/**
 * Wraps a Web Storage, swallowing the errors private modes and full quotas
 * throw. A write the storage refuses is kept in memory and read back from
 * there for the rest of the visit; everything else is read from the storage
 * each time, so writes from other tabs show.
 */
export class WebStore implements KeyValueStore {
  private readonly storage: Storage;
  /** Writes the storage refused; null marks a refused removal. */
  private readonly unsaved = new Map<string, string | null>();

  constructor(storage: Storage) {
    this.storage = storage;
  }

  getItem(key: string): string | null {
    if (this.unsaved.has(key)) return this.unsaved.get(key) ?? null;
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
      this.unsaved.delete(key);
    } catch {
      // Quota or a blocked storage: the visit goes on without saving.
      this.unsaved.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
      this.unsaved.delete(key);
    } catch {
      this.unsaved.set(key, null);
    }
  }
}

/**
 * localStorage when the browser exposes it, even read-only (a full quota still
 * reads the saved progress); memory where touching it throws or it is missing.
 */
export function browserStore(): KeyValueStore {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    return storage === undefined ? new MemoryStore() : new WebStore(storage);
  } catch {
    return new MemoryStore();
  }
}
