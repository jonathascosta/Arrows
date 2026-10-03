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

/** Wraps a Web Storage, swallowing the errors private modes and full quotas throw. */
export class WebStore implements KeyValueStore {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      // Quota or a blocked storage: the game goes on without saving.
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // As above.
    }
  }
}

/** localStorage when the browser allows it, memory otherwise (some private modes). */
export function browserStore(): KeyValueStore {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    if (storage === undefined) return new MemoryStore();
    const probe = '__arrows_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return new WebStore(storage);
  } catch {
    return new MemoryStore();
  }
}
