import { DELTA, DIRECTIONS } from '../board/direction.ts';
import { activeCells, cellIndex, inBounds } from '../board/mask.ts';
import type { Cell, Mask, Path } from '../board/types.ts';
import type { Rng } from '../rng/rng.ts';

export interface PartitionOptions {
  /** Mean path length the walks aim for; the distribution is geometric from `minLength`. */
  readonly meanLength: number;
  readonly maxLength: number;
  readonly minLength?: number;
  /**
   * How often a walk prefers the neighbour with the fewest free neighbours
   * (Warnsdorff's rule), which leaves fewer stranded single cells. 0 to 1.
   */
  readonly warnsdorff?: number;
}

/**
 * Partitions the active cells of the mask into simple paths, each inside one
 * colour. Phase one of generation; the paths have no heads yet.
 *
 * Cells are visited in a random order; from each unowned cell a random walk
 * claims free same-colour neighbours up to a sampled target length. A final
 * pass attaches stranded single cells to an adjacent path end, so singles stay
 * a feature of the drawing rather than an artefact of the walk.
 */
export function partition(mask: Mask, rng: Rng, options: PartitionOptions): Path[] {
  const minLength = Math.max(1, options.minLength ?? 1);
  const maxLength = Math.max(minLength, options.maxLength);
  const meanLength = Math.min(Math.max(options.meanLength, minLength), maxLength);
  const warnsdorff = options.warnsdorff ?? 0.75;

  const owner = new Int32Array(mask.width * mask.height).fill(-1);
  const paths: Cell[][] = [];
  const colors: number[] = [];

  const freeNeighbours = (cell: Cell, color: number): Cell[] => {
    const result: Cell[] = [];
    for (const direction of DIRECTIONS) {
      const { dx, dy } = DELTA[direction];
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (!inBounds(mask, x, y)) continue;
      const index = cellIndex(mask, x, y);
      if (mask.active[index] !== 1 || owner[index] !== -1 || mask.color[index] !== color) continue;
      result.push({ x, y });
    }
    return result;
  };

  const sampleLength = (): number => {
    const spread = meanLength - minLength;
    const draw = spread <= 0 ? 0 : -Math.log(1 - rng.next()) * spread;
    return Math.min(maxLength, minLength + Math.floor(draw));
  };

  for (const start of rng.shuffle(activeCells(mask))) {
    const startIndex = cellIndex(mask, start.x, start.y);
    if (owner[startIndex] !== -1) continue;
    const color = mask.color[startIndex]!;
    const pathIndex = paths.length;
    const cells: Cell[] = [start];
    owner[startIndex] = pathIndex;
    const target = sampleLength();
    let current = start;
    while (cells.length < target) {
      const candidates = freeNeighbours(current, color);
      if (candidates.length === 0) break;
      let next: Cell;
      if (rng.next() < warnsdorff) {
        const degrees = candidates.map((cell) => freeNeighbours(cell, color).length);
        const lowest = Math.min(...degrees);
        next = rng.pick(candidates.filter((_, i) => degrees[i] === lowest));
      } else {
        next = rng.pick(candidates);
      }
      owner[cellIndex(mask, next.x, next.y)] = pathIndex;
      cells.push(next);
      current = next;
    }
    paths.push(cells);
    colors.push(color);
  }

  mergeSingles(mask, rng, paths, colors, owner, maxLength);

  const result: Path[] = [];
  paths.forEach((cells, i) => {
    if (cells.length > 0) result.push({ cells, color: colors[i]! });
  });
  return result;
}

/** Attaches single cells to an adjacent end of a same-colour path when one has room. */
function mergeSingles(
  mask: Mask,
  rng: Rng,
  paths: Cell[][],
  colors: number[],
  owner: Int32Array,
  maxLength: number,
): void {
  const singles = rng.shuffle(paths.map((_, i) => i).filter((i) => paths[i]!.length === 1));
  for (const singleIndex of singles) {
    const single = paths[singleIndex]!;
    if (single.length !== 1) continue; // another single already joined it
    const cell = single[0]!;
    const color = colors[singleIndex]!;
    const options: { pathIndex: number; atTail: boolean }[] = [];
    for (const direction of DIRECTIONS) {
      const { dx, dy } = DELTA[direction];
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (!inBounds(mask, x, y)) continue;
      const pathIndex = owner[cellIndex(mask, x, y)]!;
      if (pathIndex === -1 || pathIndex === singleIndex || colors[pathIndex] !== color) continue;
      const path = paths[pathIndex]!;
      if (path.length >= maxLength) continue;
      const tail = path[0]!;
      const head = path[path.length - 1]!;
      if (tail.x === x && tail.y === y) options.push({ pathIndex, atTail: true });
      else if (head.x === x && head.y === y) options.push({ pathIndex, atTail: false });
    }
    if (options.length === 0) continue;
    const { pathIndex, atTail } = rng.pick(options);
    const path = paths[pathIndex]!;
    if (atTail) path.unshift(cell);
    else path.push(cell);
    owner[cellIndex(mask, cell.x, cell.y)] = pathIndex;
    single.length = 0;
  }
}
