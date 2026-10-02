import type { Mask, Puzzle, RayMode } from '../board/types.ts';
import { createRng } from '../rng/rng.ts';
import type { Seed } from '../rng/rng.ts';
import { analyze } from '../solver/solve.ts';
import type { Analysis } from '../solver/solve.ts';
import { partition } from './partition.ts';
import type { PartitionOptions } from './partition.ts';
import { peel } from './peel.ts';
import type { PeelOptions } from './peel.ts';

export interface GenerateOptions {
  readonly mask: Mask;
  readonly seed: Seed;
  readonly partition: PartitionOptions;
  readonly peel: PeelOptions;
  readonly rayMode?: RayMode;
}

export interface GeneratedPuzzle {
  readonly puzzle: Puzzle;
  readonly analysis: Analysis;
  /** Paths split by the peel because nothing could be removed. */
  readonly repairs: number;
}

/** One puzzle from one seed: partition, peel, verify. */
export function generatePuzzle(options: GenerateOptions): GeneratedPuzzle {
  const rng = createRng(options.seed);
  const rayMode = options.rayMode ?? 'bounds';
  const paths = partition(options.mask, rng.fork('partition'), options.partition);
  const peeled = peel(options.mask, paths, rng.fork('peel'), options.peel, rayMode);
  const puzzle: Puzzle = {
    width: options.mask.width,
    height: options.mask.height,
    mask: options.mask,
    arrows: peeled.arrows,
    rayMode,
    seed: rng.seed,
  };
  const analysis = analyze(puzzle);
  if (!analysis.solvable) {
    throw new Error(`Generated an unsolvable puzzle for seed ${rng.seed}; this is a bug`);
  }
  return { puzzle, analysis, repairs: peeled.repairs };
}

export interface TargetBand {
  /** Inclusive band for `Analysis.avgFreeRatio`. */
  readonly avgFreeRatio: readonly [number, number];
}

/** Among candidates inside the band, which one wins. */
export type Preference = 'easiest' | 'hardest' | 'first';

export interface GenerateInBandOptions extends GenerateOptions {
  readonly target: TargetBand;
  /** Candidates tried (sub-seeds of `seed`). */
  readonly candidates: number;
  readonly prefer?: Preference;
}

/**
 * Generates `candidates` puzzles from sub-seeds and keeps one inside the
 * target band: the easiest, the hardest or the first found, per `prefer`. With
 * none inside, the nearest to the band. Still deterministic: the same seed
 * always picks the same candidate.
 */
export function generateInBand(options: GenerateInBandOptions): GeneratedPuzzle {
  const [low, high] = options.target.avgFreeRatio;
  const prefer = options.prefer ?? 'first';
  let best: GeneratedPuzzle | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < Math.max(1, options.candidates); i++) {
    const candidate = generatePuzzle({ ...options, seed: `${options.seed}#${i}` });
    const ratio = candidate.analysis.avgFreeRatio;
    const distance = ratio < low ? low - ratio : ratio > high ? ratio - high : 0;
    if (distance === 0 && prefer === 'first') return candidate;
    const better =
      distance < bestDistance ||
      (distance === 0 &&
        bestDistance === 0 &&
        best !== undefined &&
        (prefer === 'hardest'
          ? ratio < best.analysis.avgFreeRatio
          : ratio > best.analysis.avgFreeRatio));
    if (better) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best!;
}
