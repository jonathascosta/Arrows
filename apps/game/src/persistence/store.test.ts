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

  it('never throws: a refused write is lost, a refused read is empty', () => {
    const store = new WebStore(brokenStorage());
    expect(() => store.setItem('a', '1')).not.toThrow();
    expect(() => store.removeItem('a')).not.toThrow();
    expect(store.getItem('a')).toBeNull();
  });
});

describe('browserStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses localStorage when it works', () => {
    localStorage.clear();
    const store = browserStore();
    expect(store).toBeInstanceOf(WebStore);
    store.setItem('arrows.test', 'y');
    expect(localStorage.getItem('arrows.test')).toBe('y');
    // The probe leaves nothing behind.
    expect(localStorage.length).toBe(1);
  });

  it('falls back to memory when localStorage refuses writes or is missing', () => {
    vi.stubGlobal('localStorage', brokenStorage());
    expect(browserStore()).toBeInstanceOf(MemoryStore);
    vi.stubGlobal('localStorage', undefined);
    expect(browserStore()).toBeInstanceOf(MemoryStore);
  });
});
