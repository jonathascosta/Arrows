import { describe, expect, it } from 'vitest';
import { PreferencesStore } from './preferences.ts';
import type { PreferencesApi } from './preferences.ts';

/** Preferences in memory, with every call recorded and a way to make calls fail. */
class FakePreferences implements PreferencesApi {
  readonly saved = new Map<string, string>();
  readonly calls: string[] = [];
  failing = new Set<string>();

  keys(): Promise<{ keys: string[] }> {
    this.calls.push('keys');
    if (this.failing.has('keys')) return Promise.reject(new Error('keys'));
    return Promise.resolve({ keys: [...this.saved.keys()] });
  }

  get({ key }: { key: string }): Promise<{ value: string | null }> {
    this.calls.push(`get ${key}`);
    if (this.failing.has(`get ${key}`)) return Promise.reject(new Error(`get ${key}`));
    return Promise.resolve({ value: this.saved.get(key) ?? null });
  }

  async set({ key, value }: { key: string; value: string }): Promise<void> {
    // A save takes a moment, so a write made after it must not land first.
    await Promise.resolve();
    this.calls.push(`set ${key}=${value}`);
    if (this.failing.has(`set ${key}`)) throw new Error(`set ${key}`);
    this.saved.set(key, value);
  }

  remove({ key }: { key: string }): Promise<void> {
    this.calls.push(`remove ${key}`);
    this.saved.delete(key);
    return Promise.resolve();
  }
}

describe('PreferencesStore', () => {
  it('reads every saved key at start, and answers from memory after', async () => {
    const api = new FakePreferences();
    api.saved.set('arrows.progress', '{"version":1}');
    api.saved.set('arrows.league', '{"version":1}');
    const store = await PreferencesStore.load(api);
    expect(store.getItem('arrows.progress')).toBe('{"version":1}');
    expect(store.getItem('arrows.league')).toBe('{"version":1}');
    expect(store.getItem('arrows.daily')).toBeNull();
    api.calls.length = 0;
    store.getItem('arrows.progress');
    expect(api.calls).toEqual([]);
  });

  it('changes the memory at once and saves the writes in order behind it', async () => {
    const api = new FakePreferences();
    const store = await PreferencesStore.load(api);
    store.setItem('a', '1');
    store.setItem('a', '2');
    store.removeItem('b');
    store.setItem('b', '3');
    expect(store.getItem('a')).toBe('2');
    expect(store.getItem('b')).toBe('3');
    await store.flushed();
    expect(api.calls.filter((call) => !call.startsWith('keys'))).toEqual([
      'set a=1',
      'set a=2',
      'remove b',
      'set b=3',
    ]);
    expect(api.saved).toEqual(
      new Map([
        ['a', '2'],
        ['b', '3'],
      ]),
    );
    store.removeItem('a');
    expect(store.getItem('a')).toBeNull();
    await store.flushed();
    expect(api.saved.has('a')).toBe(false);
  });

  it('reports what it cannot read or save, and goes on', async () => {
    const errors: string[] = [];
    const report = (error: unknown): void => {
      errors.push(error instanceof Error ? error.message : String(error));
    };
    const api = new FakePreferences();
    api.saved.set('good', 'yes');
    api.saved.set('bad', 'no');
    api.failing.add('get bad');
    const store = await PreferencesStore.load(api, report);
    expect(store.getItem('good')).toBe('yes');
    expect(store.getItem('bad')).toBeNull();
    expect(errors).toEqual(['get bad']);

    api.failing.add('set good');
    store.setItem('good', 'again');
    store.setItem('other', 'saved');
    await store.flushed();
    // The failed save keeps the value for this session; the next write still lands.
    expect(store.getItem('good')).toBe('again');
    expect(api.saved.get('other')).toBe('saved');
    expect(errors).toEqual(['get bad', 'set good']);

    // Preferences that cannot even list their keys: start empty.
    const broken = new FakePreferences();
    broken.failing.add('keys');
    const empty = await PreferencesStore.load(broken, report);
    expect(empty.getItem('good')).toBeNull();
    expect(errors.at(-1)).toBe('keys');
  });
});
