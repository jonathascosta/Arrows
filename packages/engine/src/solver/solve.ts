import type { Puzzle } from '../board/types.ts';
import { head } from '../board/types.ts';
import { clearArrow, createOccupancy, rayStatus } from './occupancy.ts';
import type { Occupancy } from './occupancy.ts';

export interface Analysis {
  /** False only for a corrupt puzzle: the generator never produces one. */
  readonly solvable: boolean;
  /** The order the reference policy removed the arrows in (ids). */
  readonly solution: readonly number[];
  readonly arrowCount: number;
  readonly cellCount: number;
  readonly avgPathLength: number;
  readonly maxPathLength: number;
  /** Share of one-cell arrows. */
  readonly singleRatio: number;
  /** Free arrows before the first move. */
  readonly freeAtStart: number;
  /** Mean number of free arrows over the steps of the reference solution. */
  readonly avgFree: number;
  readonly minFree: number;
  /**
   * Free arrows over remaining arrows, summed over the steps of the solution:
   * the share of the board that is playable at any moment, weighted towards
   * the full board. The main difficulty signal.
   */
  readonly avgFreeRatio: number;
  /** Mean ray length of the arrow removed at each step. */
  readonly avgRayLength: number;
  /** Share of arrows whose head sits at the edge, pointing out (ray length 0). */
  readonly borderHeadRatio: number;
  /** Mean number, per step, of arrows blocked by exactly one cell: the ones that cost a life (a chance, in the app). */
  readonly avgNearMiss: number;
  /** A provisional 0 to 100 composite; tiers are tuned on the raw metrics. */
  readonly difficulty: number;
}

/**
 * Solves the puzzle with a fixed policy (the free arrow with the shortest ray,
 * lowest id first: what a player who clears the edges first would do) and
 * measures what the player faces along the way. Deterministic, allocation-light.
 */
export function analyze(puzzle: Puzzle): Analysis {
  const { mask, arrows, rayMode } = puzzle;
  const occupancy: Occupancy = createOccupancy(puzzle);
  const remaining = new Set<number>(arrows.map((arrow) => arrow.id));
  const solution: number[] = [];

  let freeSum = 0;
  let remainingSum = 0;
  let minFree = Number.POSITIVE_INFINITY;
  let freeAtStart = 0;
  let raySum = 0;
  let nearMissSum = 0;
  let steps = 0;

  while (remaining.size > 0) {
    let best = -1;
    let bestRay = Number.POSITIVE_INFINITY;
    let free = 0;
    let nearMiss = 0;
    for (const id of remaining) {
      const arrow = arrows[id]!;
      const status = rayStatus(mask, occupancy, head(arrow), arrow.direction, rayMode);
      if (status.blockers === 0) {
        free++;
        if (status.length < bestRay || (status.length === bestRay && id < best)) {
          best = id;
          bestRay = status.length;
        }
      } else if (status.blockers === 1) {
        nearMiss++;
      }
    }
    if (steps === 0) freeAtStart = free;
    if (best === -1) break;
    freeSum += free;
    remainingSum += remaining.size;
    minFree = Math.min(minFree, free);
    nearMissSum += nearMiss;
    raySum += bestRay;
    steps++;
    clearArrow(occupancy, mask, arrows[best]!);
    remaining.delete(best);
    solution.push(best);
  }

  const cellCount = arrows.reduce((sum, arrow) => sum + arrow.cells.length, 0);
  const maxPathLength = arrows.reduce((max, arrow) => Math.max(max, arrow.cells.length), 0);
  const singles = arrows.filter((arrow) => arrow.cells.length === 1).length;
  const borderHeads = arrows.filter(
    (arrow) => rayStatus(mask, occupancy, head(arrow), arrow.direction, rayMode).length === 0,
  ).length;
  const safeSteps = Math.max(1, steps);
  const avgFree = freeSum / safeSteps;
  const avgFreeRatio = remainingSum === 0 ? 0 : freeSum / remainingSum;
  const avgRayLength = raySum / safeSteps;
  const avgNearMiss = nearMissSum / safeSteps;
  const arrowCount = arrows.length;

  return {
    solvable: remaining.size === 0,
    solution,
    arrowCount,
    cellCount,
    avgPathLength: arrowCount === 0 ? 0 : cellCount / arrowCount,
    maxPathLength,
    singleRatio: arrowCount === 0 ? 0 : singles / arrowCount,
    freeAtStart,
    avgFree,
    minFree: Number.isFinite(minFree) ? minFree : 0,
    avgFreeRatio,
    avgRayLength,
    borderHeadRatio: arrowCount === 0 ? 0 : borderHeads / arrowCount,
    avgNearMiss,
    difficulty: difficultyScore(arrowCount, avgFreeRatio, avgRayLength),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Provisional composite: size, scarcity of free arrows, depth of the heads. */
export function difficultyScore(
  arrowCount: number,
  avgFreeRatio: number,
  avgRayLength: number,
): number {
  const size = clamp01(Math.log(Math.max(1, arrowCount)) / Math.log(500));
  const scarcity = clamp01(1 - avgFreeRatio / 0.35);
  const depth = clamp01(avgRayLength / 10);
  return Math.round(100 * (0.4 * size + 0.4 * scarcity + 0.2 * depth));
}
