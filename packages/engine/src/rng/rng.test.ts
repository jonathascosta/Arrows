import { describe, expect, it } from 'vitest';
import { createRng, cyrb53 } from './rng.ts';

describe('createRng', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = Array.from({ length: 5 }, () => createRng('level:1').next());
    const b = Array.from({ length: 5 }, () => createRng('level:1').next());
    const c = Array.from({ length: 5 }, () => createRng('level:2').next());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('treats a number seed as its string', () => {
    expect(createRng(7).next()).toBe(createRng('7').next());
  });

  it('draws floats in [0, 1) and integers in [0, n)', () => {
    const rng = createRng('range');
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('draws integers close to uniformly', () => {
    const rng = createRng('uniform');
    const counts = new Array<number>(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) counts[rng.int(10)]!++;
    for (const count of counts) expect(Math.abs(count / draws - 0.1)).toBeLessThan(0.01);
  });

  it('shuffles every permutation of three items', () => {
    const rng = createRng('shuffle');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rng.shuffle(['a', 'b', 'c']).join(''));
    expect(seen.size).toBe(6);
  });

  it('forks independent streams that are themselves deterministic', () => {
    const base = createRng('base');
    const x = base.fork('partition').next();
    const y = base.fork('orientation').next();
    expect(x).not.toBe(y);
    expect(createRng('base').fork('partition').next()).toBe(x);
  });

  it('rejects int(n) for n < 1', () => {
    expect(() => createRng('x').int(0)).toThrow(RangeError);
  });

  it('hashes strings to two 32-bit words', () => {
    const [a, b] = cyrb53('arrows');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(cyrb53('arrows')).toEqual([a, b]);
    expect(cyrb53('arrowz')).not.toEqual([a, b]);
  });
});
