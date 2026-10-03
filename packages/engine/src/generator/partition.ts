import { DELTA, DIRECTIONS } from '../board/direction.ts';
import { activeCells, cellIndex, inBounds } from '../board/mask.ts';
import type { Cell, Mask, Path } from '../board/types.ts';
import type { Rng } from '../rng/rng.ts';
import { edgeKey } from './ends.ts';

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
  /**
   * How often a walk step prefers a neighbour that turns (changes direction)
   * when one exists: winding paths instead of straight runs. 0 to 1, default 0.
   */
  readonly turn?: number;
  /**
   * When a walk is stuck before its target length, grow it from its first cell
   * too. Default false.
   */
  readonly growBothEnds?: boolean;
  /**
   * After the walks, joins each path shorter than this end to end with an
   * adjacent path of the same colour when the two fit in `maxLength`.
   * Default 0 (off); single cells are always attached when they can be.
   */
  readonly joinBelow?: number;
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
  const turn = options.turn ?? 0;

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
    let atStart = false;
    while (cells.length < target) {
      let candidates = freeNeighbours(current, color);
      if (candidates.length === 0) {
        if (!options.growBothEnds || atStart || cells.length < 2) break;
        atStart = true;
        current = cells[0]!;
        continue;
      }
      if (turn > 0 && cells.length >= 2 && rng.next() < turn) {
        const before = atStart ? cells[1]! : cells[cells.length - 2]!;
        const dx = current.x - before.x;
        const dy = current.y - before.y;
        const turning = candidates.filter(
          (cell) => cell.x - current.x !== dx || cell.y - current.y !== dy,
        );
        if (turning.length > 0) candidates = turning;
      }
      let next: Cell;
      if (rng.next() < warnsdorff) {
        const degrees = candidates.map((cell) => freeNeighbours(cell, color).length);
        const lowest = Math.min(...degrees);
        next = rng.pick(candidates.filter((_, i) => degrees[i] === lowest));
      } else {
        next = rng.pick(candidates);
      }
      owner[cellIndex(mask, next.x, next.y)] = pathIndex;
      if (atStart) cells.unshift(next);
      else cells.push(next);
      current = next;
    }
    paths.push(cells);
    colors.push(color);
  }

  mergeSingles(mask, rng, paths, colors, owner, maxLength);
  if ((options.joinBelow ?? 0) > 1) {
    joinShort(mask, rng, paths, colors, owner, maxLength, options.joinBelow!);
  }
  if (new Set(colors).size > 1) splitFacingEnds(mask, paths, colors, owner);

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

/**
 * Joins short paths end to end with an adjacent path, shortest partner first,
 * so fewer short arrows remain. Both paths keep their cells; the result is
 * one simple path through the shared corner.
 */
function joinShort(
  mask: Mask,
  rng: Rng,
  paths: Cell[][],
  colors: number[],
  owner: Int32Array,
  maxLength: number,
  below: number,
): void {
  const order = rng.shuffle(paths.map((_, i) => i).filter((i) => paths[i]!.length > 0));
  for (const index of order) {
    const path = paths[index]!;
    if (path.length === 0 || path.length >= below) continue;
    const options: { other: number; mineAtStart: boolean; otherAtStart: boolean }[] = [];
    let shortest = Number.POSITIVE_INFINITY;
    for (const mineAtStart of path.length === 1 ? [true] : [true, false]) {
      const end = mineAtStart ? path[0]! : path[path.length - 1]!;
      for (const direction of DIRECTIONS) {
        const { dx, dy } = DELTA[direction];
        const x = end.x + dx;
        const y = end.y + dy;
        if (!inBounds(mask, x, y)) continue;
        const other = owner[cellIndex(mask, x, y)]!;
        if (other === -1 || other === index || colors[other] !== colors[index]) continue;
        const otherPath = paths[other]!;
        if (otherPath.length + path.length > maxLength) continue;
        const first = otherPath[0]!;
        const last = otherPath[otherPath.length - 1]!;
        const ends: boolean[] = [];
        if (first.x === x && first.y === y) ends.push(true);
        if (last.x === x && last.y === y && otherPath.length > 1) ends.push(false);
        for (const otherAtStart of ends) {
          if (otherPath.length < shortest) {
            shortest = otherPath.length;
            options.length = 0;
          }
          if (otherPath.length === shortest) options.push({ other, mineAtStart, otherAtStart });
        }
      }
    }
    if (options.length === 0) continue;
    const { other, mineAtStart, otherAtStart } = rng.pick(options);
    // Mine with the joining end last, then the other path from its joining end.
    const mine = mineAtStart ? [...path].reverse() : path;
    const theirs = otherAtStart ? paths[other]! : [...paths[other]!].reverse();
    const joined = [...mine, ...theirs];
    paths[index] = joined;
    paths[other] = [];
    for (const cell of theirs) owner[cellIndex(mask, cell.x, cell.y)] = index;
  }
}

/**
 * A path end is drawn on the edge beyond its end cell, along its last segment,
 * whichever end becomes the head. Two ends of different colours on one edge
 * (they face each other) would share a drawing node, and paths of two colours
 * cannot be joined; so the end cell of the longer one becomes a single cell,
 * whose direction the peel chooses away from the other end.
 */
function splitFacingEnds(mask: Mask, paths: Cell[][], colors: number[], owner: Int32Array): void {
  const nodeOf = (path: readonly Cell[], atStart: boolean): number => {
    const end = atStart ? path[0]! : path[path.length - 1]!;
    const before = atStart ? path[1]! : path[path.length - 2]!;
    return edgeKey(mask, end, { x: 2 * end.x - before.x, y: 2 * end.y - before.y });
  };
  for (let guard = 0; guard < 4 * paths.length; guard++) {
    const seen = new Map<number, { path: number; atStart: boolean }>();
    let found: { path: number; atStart: boolean } | undefined;
    for (let i = 0; i < paths.length && found === undefined; i++) {
      const path = paths[i]!;
      if (path.length < 2) continue;
      for (const atStart of [true, false]) {
        const node = nodeOf(path, atStart);
        if (node === -1) continue;
        const other = seen.get(node);
        if (other === undefined) {
          seen.set(node, { path: i, atStart });
        } else if (colors[other.path] !== colors[i]) {
          found = paths[other.path]!.length >= path.length ? other : { path: i, atStart };
          break;
        }
      }
    }
    if (found === undefined) return;
    const path = paths[found.path]!;
    const cell = found.atStart ? path.shift()! : path.pop()!;
    owner[cellIndex(mask, cell.x, cell.y)] = paths.length;
    paths.push([cell]);
    colors.push(colors[found.path]!);
  }
}
