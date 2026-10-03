import type { PartitionOptions } from '../generator/partition.ts';
import type { PeelOptions } from '../generator/peel.ts';
import type { Preference, TargetBand } from '../generator/generate.ts';

export type Tier = 'easy' | 'medium' | 'hard' | 'superHard';

export const TIER_ORDER: readonly Tier[] = ['easy', 'medium', 'hard', 'superHard'];

export interface TierParams {
  readonly label: string;
  /** Board at level 1: [width, height]. */
  readonly base: readonly [number, number];
  /** How much the board grows by the plateau level (0.5 means 50% wider and taller). */
  readonly growth: number;
  readonly partition: PartitionOptions;
  readonly peel: PeelOptions;
  readonly candidates: number;
  readonly target: TargetBand;
  readonly prefer: Preference;
}

/** Sizes stop growing here. */
export const PLATEAU_LEVEL = 300;

/**
 * The knobs per tier. The bands are what the calibration suite enforces on the
 * generated puzzles; the other values are how we get there.
 *
 * What the measurements say (see the calibration suite): with a random peel
 * the number of free arrows at any moment is about 3 to 6 whatever the board,
 * so easy and medium get harder with size alone; the peel bias moves heads
 * inward and makes rays longer. Hard and super hard score the peel instead
 * (`freshness`): each step peels the end freed most recently, so a player sees
 * about 3 (hard) and 2 (super hard) free arrows at a time, with fewer queues;
 * their walks are longer and wind, and both cut a path rather than use a
 * stale end: super hard as soon as the best end is not the freshest
 * (`staleCut: 0`), hard once it is 4 removals stale. Picking the hardest of several candidates trims the outliers.
 * The bands overlap on purpose: a medium board at level 300 is about as hard
 * as a hard board at level 11, as in the reference game, where the label is
 * relative to the path.
 */
export const TIERS: Readonly<Record<Tier, TierParams>> = {
  easy: {
    label: 'Easy',
    base: [6, 8],
    growth: 0,
    partition: { meanLength: 3, maxLength: 6 },
    peel: { bias: 0 },
    candidates: 4,
    target: { avgFreeRatio: [0.3, 1] },
    prefer: 'easiest',
  },
  medium: {
    label: 'Medium',
    base: [9, 13],
    growth: 0.45,
    partition: { meanLength: 4, maxLength: 10 },
    peel: { bias: 0.3 },
    candidates: 4,
    target: { avgFreeRatio: [0.11, 0.36] },
    prefer: 'first',
  },
  hard: {
    label: 'Hard',
    base: [11, 16],
    growth: 0.5,
    partition: { meanLength: 7, maxLength: 16, turn: 0.5, growBothEnds: true, joinBelow: 3 },
    peel: {
      bias: 0.6,
      freshness: 1,
      commitment: 1000,
      queuePenalty: 4,
      staleCut: 4,
      cutMinPiece: 3,
      repair: 'cut',
    },
    candidates: 6,
    target: { avgFreeRatio: [0.06, 0.2] },
    prefer: 'hardest',
  },
  superHard: {
    label: 'Super Hard',
    base: [14, 20],
    growth: 0.45,
    partition: { meanLength: 16, maxLength: 40, turn: 0.5, growBothEnds: true, joinBelow: 4 },
    peel: {
      bias: 0.85,
      freshness: 1,
      commitment: 1000,
      queuePenalty: 4,
      staleCut: 0,
      cutMinPiece: 3,
      repair: 'cut',
    },
    candidates: 8,
    target: { avgFreeRatio: [0.03, 0.14] },
    prefer: 'hardest',
  },
};

/**
 * Levels 1 to 10 are easy. From 11 on, each block of 10 goes
 * medium, medium, hard, medium, medium, medium, hard, medium, medium, super hard,
 * so level 300 is super hard and 303 is hard.
 */
export function tierForLevel(level: number): Tier {
  if (!Number.isInteger(level) || level < 1)
    throw new RangeError(`Level must be >= 1, got ${level}`);
  if (level <= 10) return 'easy';
  const position = ((level - 1) % 10) + 1;
  if (position === 10) return 'superHard';
  if (position === 3 || position === 7) return 'hard';
  return 'medium';
}

/** Board size for a level: the tier's base, grown linearly up to the plateau. */
export function boardSizeForLevel(
  level: number,
  tier: Tier = tierForLevel(level),
): [number, number] {
  const { base, growth } = TIERS[tier];
  const progress = Math.min(1, Math.max(0, level - 1) / (PLATEAU_LEVEL - 1));
  const factor = 1 + growth * progress;
  return [Math.round(base[0] * factor), Math.round(base[1] * factor)];
}
