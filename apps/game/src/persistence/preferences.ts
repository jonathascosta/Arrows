import type { KeyValueStore } from './store.ts';

/** What the store needs of Capacitor's `Preferences` plugin (UserDefaults on iOS). */
export interface PreferencesApi {
  keys(): Promise<{ keys: string[] }>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

/**
 * The iOS store: Capacitor's `Preferences`, which iOS keeps for good, where a
 * web view's localStorage can be cleared when the phone runs short of space.
 * `Preferences` answers asynchronously and the game reads synchronously, so
 * every key is read once at start (`load`) and kept in memory; a write changes
 * the memory at once and is saved behind it. On a phone the app is the only
 * writer, so the memory is always the latest.
 */
export class PreferencesStore implements KeyValueStore {
  private readonly api: PreferencesApi;
  private readonly values: Map<string, string>;
  private readonly onError: (error: unknown) => void;
  /** The writes not saved yet, in order, so a later write never lands before an earlier one. */
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    api: PreferencesApi,
    values: Map<string, string>,
    onError: (error: unknown) => void,
  ) {
    this.api = api;
    this.values = values;
    this.onError = onError;
  }

  /** Reads every stored key; a key that cannot be read is left out, as if never saved. */
  static async load(
    api: PreferencesApi,
    onError: (error: unknown) => void = () => undefined,
  ): Promise<PreferencesStore> {
    const values = new Map<string, string>();
    try {
      const { keys } = await api.keys();
      const read = await Promise.allSettled(keys.map((key) => api.get({ key })));
      read.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.value !== null) {
          values.set(keys[i]!, result.value.value);
        } else if (result.status === 'rejected') {
          onError(result.reason);
        }
      });
    } catch (error) {
      onError(error);
    }
    return new PreferencesStore(api, values, onError);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.save(() => this.api.set({ key, value }));
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.save(() => this.api.remove({ key }));
  }

  /** Resolves once every write so far has been saved, or has failed. */
  flushed(): Promise<void> {
    return this.queue;
  }

  private save(write: () => Promise<void>): void {
    // A write that fails keeps the value in memory for this session; it is reported, never thrown.
    this.queue = this.queue.then(write).catch(this.onError);
  }
}
