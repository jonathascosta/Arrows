import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, MemoryStore, WebStore } from './store.ts';

/** A Web Storage that refuses everything, like Safari's old private mode. */
function brokenStorage(): Storage {
  const fail = (): never => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  };
  return {
    length: 0,
    clear: fail,
    key: fail,
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  };
}

describe('MemoryStore', () => {
  it('keeps values until they are removed', () => {
    const store = new MemoryStore();
    expect(store.getItem('a')).toBeNull();
    store.setItem('a', '1');
    expect(store.getItem('a')).toBe('1');
    store.removeItem('a');
    expect(store.getItem('a')).toBeNull();
  });
});

describe('WebStore', () => {
  it('reads and writes through the storage', () => {
    localStorage.clear();
    const store = new WebStore(localStorage);
    store.setItem('arrows.test', 'x');
    expect(localStorage.getItem('arrows.test')).toBe('x');
    expect(store.getItem('arrows.test')).toBe('x');
    store.removeItem('arrows.test');
    expect(localStorage.getItem('arrows.test')).toBeNull();
  });

  it('never throws, and keeps a refused write for the rest of the visit', () => {
    const store = new WebStore(brokenStorage());
    expect(store.getItem('a')).toBeNull();
    expect(() => store.setItem('a', '1')).not.toThrow();
    expect(store.getItem('a')).toBe('1');
    expect(() => store.removeItem('a')).not.toThrow();
    expect(store.getItem('a')).toBeNull();
  });

  it('still reads a storage that refuses writes, as a full quota does', () => {
    localStorage.clear();
    localStorage.setItem('arrows.test', 'saved');
    const quota = (): never => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
    const storage: Storage = {
      get length() {
        return localStorage.length;
      },
      clear: () => localStorage.clear(),
      key: (index) => localStorage.key(index),
      getItem: (key) => localStorage.getItem(key),
      setItem: quota,
      removeItem: quota,
    };
    const store = new WebStore(storage);
    expect(store.getItem('arrows.test')).toBe('saved');
    store.setItem('arrows.test', 'newer');
    expect(store.getItem('arrows.test')).toBe('newer');
    expect(localStorage.getItem('arrows.test')).toBe('saved');
  });

  it('reads what another tab wrote since', () => {
    localStorage.clear();
    const store = new WebStore(localStorage);
    store.setItem('arrows.test', 'mine');
    localStorage.setItem('arrows.test', 'theirs');
    expect(store.getItem('arrows.test')).toBe('theirs');
  });
});

describe('browserStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses localStorage when the browser exposes it', () => {
    localStorage.clear();
    const store = browserStore();
    expect(store).toBeInstanceOf(WebStore);
    store.setItem('arrows.test', 'y');
    expect(localStorage.getItem('arrows.test')).toBe('y');
    expect(localStorage.length).toBe(1);
  });

  it('falls back to memory when touching localStorage throws or it is missing', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(browserStore()).toBeInstanceOf(MemoryStore);
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', undefined);
    expect(browserStore()).toBeInstanceOf(MemoryStore);
  });
});
