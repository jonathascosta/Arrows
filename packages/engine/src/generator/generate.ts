import type { Direction } from '../board/direction.ts';
import type { Arrow, Cell, Mask, Puzzle, RayMode } from '../board/types.ts';
import { createRng } from '../rng/rng.ts';
import type { Seed } from '../rng/rng.ts';
import { analyze } from '../solver/solve.ts';
import type { Analysis } from '../solver/solve.ts';
import { endConflicts, separateEnds } from './ends.ts';
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
  /**
   * Join or reshape arrows so that no two arrow ends share a drawing node
   * (see `separateEnds`). Default true.
   */
  readonly separateEnds?: boolean;
}

export interface GeneratedPuzzle {
  readonly puzzle: Puzzle;
  readonly analysis: Analysis;
  /** Paths split by the peel because nothing could be removed. */
  readonly repairs: number;
  /** Arrows joined and tails moved so that no two ends share a drawing node. */
  readonly endFixes: number;
  /**
   * Pairs of ends still sharing a node: 0 on a one-colour board; on a drawing,
   * ends of two colours that could not be joined. Band selection avoids them.
   */
  readonly endConflicts: number;
}

/** One puzzle from one seed: partition, peel, separate the ends, verify. */
export function generatePuzzle(options: GenerateOptions): GeneratedPuzzle {
  const rng = createRng(options.seed);
  const rayMode = options.rayMode ?? 'bounds';
  const paths = partition(options.mask, rng.fork('partition'), options.partition);
  const peeled = peel(options.mask, paths, rng.fork('peel'), options.peel, rayMode);
  let arrows = peeled.arrows;
  let endFixes = 0;
  if (options.separateEnds ?? true) {
    const separated = separateEnds(
      options.mask,
      peeled.solution.map((id) => peeled.arrows[id]!),
    );
    arrows = numberByHead(separated.arrows);
    endFixes = separated.merges + separated.transfers;
  }
  const conflicts = endConflicts(options.mask, arrows).length;
  const puzzle: Puzzle = {
    width: options.mask.width,
    height: options.mask.height,
    mask: options.mask,
    arrows,
    rayMode,
    seed: rng.seed,
  };
  const analysis = analyze(puzzle);
  if (!analysis.solvable) {
    throw new Error(`Generated an unsolvable puzzle for seed ${rng.seed}; this is a bug`);
  }
  return { puzzle, analysis, repairs: peeled.repairs, endFixes, endConflicts: conflicts };
}

/** Ids by head position (top to bottom, left to right), so ids do not leak the order. */
function numberByHead(
  arrows: readonly { cells: readonly Cell[]; direction: Direction; color: number }[],
): Arrow[] {
  const head = (i: number): Cell => arrows[i]!.cells[arrows[i]!.cells.length - 1]!;
  return arrows
    .map((_, i) => i)
    .sort((a, b) => head(a).y - head(b).y || head(a).x - head(b).x)
    .map((i, id) => {
      const { cells, direction, color } = arrows[i]!;
      return { id, cells, direction, color };
    });
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
 * none inside, the nearest to the band. A candidate with ends sharing a node
 * (possible only on a drawing) loses to any without, and while every candidate
 * has one, up to three times as many are tried. Still deterministic: the same
 * seed always picks the same candidate.
 */
export function generateInBand(options: GenerateInBandOptions): GeneratedPuzzle {
  const [low, high] = options.target.avgFreeRatio;
  const prefer = options.prefer ?? 'first';
  let best: GeneratedPuzzle | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  const candidates = Math.max(1, options.candidates);
  for (let i = 0; i < candidates || (best!.endConflicts > 0 && i < candidates * 3); i++) {
    const candidate = generatePuzzle({ ...options, seed: `${options.seed}#${i}` });
    const ratio = candidate.analysis.avgFreeRatio;
    const distance =
      (ratio < low ? low - ratio : ratio > high ? ratio - high : 0) +
      (candidate.endConflicts > 0 ? 1000 : 0);
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
