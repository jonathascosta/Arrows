/**
 * Seeded random numbers. Every draw in the engine goes through an `Rng`, so a
 * level number or a date produces the same puzzle on every phone, and tests can
 * replay any generation exactly.
 *
 * The generator is xoshiro128** seeded through splitmix32 from a 64-bit string
 * hash (cyrb53). `fork(label)` derives an independent stream from the same
 * seed, so one puzzle can draw its partition and its orientation from streams
 * that do not disturb each other.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  /** One element, uniformly. */
  pick<T>(items: readonly T[]): T;
  /** Shuffles in place (Fisher-Yates) and returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** A standard normal deviate (Box-Muller). */
  normal(): number;
  /** An independent stream derived from this seed and the label. */
  fork(label: string): Rng;
  /** The seed this stream was created from. */
  readonly seed: string;
}

export type Seed = string | number;

export function createRng(seed: Seed): Rng {
  const seedString = String(seed);
  const [h1, h2] = cyrb53(seedString);
  // splitmix32 expands the two hash words into four well-mixed state words.
  let mix = (h1 ^ Math.imul(h2, 0x9e3779b1)) >>> 0;
  const splitmix = (): number => {
    mix = (mix + 0x9e3779b9) | 0;
    let t = mix ^ (mix >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
  let s0 = splitmix() ^ h2;
  let s1 = splitmix();
  let s2 = splitmix() ^ h1;
  let s3 = splitmix();
  if ((s0 | s1 | s2 | s3) === 0) s3 = 1;

  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };

  const rng: Rng = {
    seed: seedString,
    next: () => nextU32() / 4294967296,
    int(n) {
      if (!Number.isInteger(n) || n <= 0) throw new RangeError(`int(n) needs n >= 1, got ${n}`);
      // Rejection sampling: unbiased for every n.
      const limit = 4294967296 - (4294967296 % n);
      let draw = nextU32();
      while (draw >= limit) draw = nextU32();
      return draw % n;
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('pick() of an empty list');
      return items[rng.int(items.length)]!;
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = items[i]!;
        items[i] = items[j]!;
        items[j] = tmp;
      }
      return items;
    },
    normal() {
      let u = 0;
      while (u === 0) u = rng.next();
      const v = rng.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork: (label) => createRng(`${seedString}/${label}`),
  };
  return rng;
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** cyrb53: a fast 64-bit string hash, returned as two 32-bit words. */
export function cyrb53(input: string, salt = 0): [number, number] {
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}
