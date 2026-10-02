import { DIRECTIONS, directionBetween } from '../board/direction.ts';
import type { Direction } from '../board/direction.ts';
import { cellIndex } from '../board/mask.ts';
import type { Arrow, Cell, Mask, Path, RayMode } from '../board/types.ts';
import type { Rng } from '../rng/rng.ts';
import { rayStatus } from '../solver/occupancy.ts';

export interface PeelOptions {
  /**
   * 0 picks the next arrow to peel uniformly among the free ones; 1 always
   * picks one with the longest ray. Higher means heads deeper inside the board
   * and fewer obvious moves, so a harder puzzle.
   */
  readonly bias: number;
}

export interface PeelResult {
  /** Ids are assigned by head position (top to bottom, left to right). */
  readonly arrows: readonly Arrow[];
  /** Arrow ids in an order that solves the puzzle. */
  readonly solution: readonly number[];
  /** Paths that had to be split because nothing could be peeled. */
  readonly repairs: number;
}

interface Piece {
  cells: Cell[];
  color: number;
  alive: boolean;
}

interface Candidate {
  piece: number;
  headAtStart: boolean;
  direction: Direction;
  rayLength: number;
}

/**
 * Phase two of generation: gives every path a head by simulating the solution
 * forward. At each step a path is chosen among those with an end whose ray is
 * free; that end becomes its head and the path leaves the board. Removal only
 * frees cells, so this greedy process never needs to backtrack. If no path can
 * be peeled, the topmost occupied cell is cut out of its path as a single cell
 * pointing up, which is free by construction.
 */
export function peel(
  mask: Mask,
  paths: readonly Path[],
  rng: Rng,
  options: PeelOptions,
  rayMode: RayMode,
): PeelResult {
  const pieces: Piece[] = paths.map((path) => ({
    cells: [...path.cells],
    color: path.color,
    alive: true,
  }));
  const occupancy = new Int32Array(mask.width * mask.height).fill(-1);
  pieces.forEach((piece, i) => {
    for (const cell of piece.cells) occupancy[cellIndex(mask, cell.x, cell.y)] = i;
  });
  let remaining = pieces.length;
  const peeled: { cells: Cell[]; direction: Direction; color: number }[] = [];
  let repairs = 0;

  while (remaining > 0) {
    const candidates: Candidate[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!;
      if (!piece.alive) continue;
      const { cells } = piece;
      if (cells.length === 1) {
        for (const direction of DIRECTIONS) {
          const status = rayStatus(mask, occupancy, cells[0]!, direction, rayMode);
          if (status.blockers === 0) {
            candidates.push({ piece: i, headAtStart: true, direction, rayLength: status.length });
          }
        }
        continue;
      }
      const last = cells[cells.length - 1]!;
      const lastDirection = directionBetween(cells[cells.length - 2]!, last);
      const lastStatus = rayStatus(mask, occupancy, last, lastDirection, rayMode);
      if (lastStatus.blockers === 0) {
        candidates.push({
          piece: i,
          headAtStart: false,
          direction: lastDirection,
          rayLength: lastStatus.length,
        });
      }
      const first = cells[0]!;
      const firstDirection = directionBetween(cells[1]!, first);
      const firstStatus = rayStatus(mask, occupancy, first, firstDirection, rayMode);
      if (firstStatus.blockers === 0) {
        candidates.push({
          piece: i,
          headAtStart: true,
          direction: firstDirection,
          rayLength: firstStatus.length,
        });
      }
    }

    if (candidates.length === 0) {
      remaining += repair(mask, pieces, occupancy);
      repairs++;
      continue;
    }

    const chosen = choose(candidates, rng, options.bias);
    const piece = pieces[chosen.piece]!;
    const cells = chosen.headAtStart ? [...piece.cells].reverse() : [...piece.cells];
    for (const cell of cells) occupancy[cellIndex(mask, cell.x, cell.y)] = -1;
    piece.alive = false;
    remaining--;
    peeled.push({ cells, direction: chosen.direction, color: piece.color });
  }

  const order = peeled.map((_, i) => i);
  order.sort((a, b) => {
    const ha = peeled[a]!.cells[peeled[a]!.cells.length - 1]!;
    const hb = peeled[b]!.cells[peeled[b]!.cells.length - 1]!;
    return ha.y - hb.y || ha.x - hb.x;
  });
  const idOf = new Map<number, number>();
  const arrows: Arrow[] = order.map((peelIndex, id) => {
    idOf.set(peelIndex, id);
    const { cells, direction, color } = peeled[peelIndex]!;
    return { id, cells, direction, color };
  });
  const solution = peeled.map((_, peelIndex) => idOf.get(peelIndex)!);
  return { arrows, solution, repairs };
}

function choose(candidates: Candidate[], rng: Rng, bias: number): Candidate {
  if (bias > 0 && rng.next() < bias) {
    const longest = Math.max(...candidates.map((c) => c.rayLength));
    return rng.pick(candidates.filter((c) => c.rayLength === longest));
  }
  return rng.pick(candidates);
}

/**
 * Cuts the topmost (then leftmost) occupied cell out of its path. It becomes
 * a single cell; what came before and after it in the path become paths of
 * their own. Pointing up, the single has nothing above it, so the next round
 * has at least one candidate in either ray mode. Returns how many new paths
 * were created (0 to 2).
 */
function repair(mask: Mask, pieces: Piece[], occupancy: Int32Array): number {
  let index = 0;
  while (index < occupancy.length && occupancy[index] === -1) index++;
  if (index === occupancy.length) throw new Error('repair() with an empty board');
  const pieceIndex = occupancy[index]!;
  const piece = pieces[pieceIndex]!;
  const x = index % mask.width;
  const y = Math.floor(index / mask.width);
  const k = piece.cells.findIndex((cell) => cell.x === x && cell.y === y);
  const before = piece.cells.slice(0, k);
  const after = piece.cells.slice(k + 1);
  piece.cells = [piece.cells[k]!];
  let created = 0;
  for (const part of [before, after]) {
    if (part.length === 0) continue;
    const newIndex = pieces.length;
    pieces.push({ cells: part, color: piece.color, alive: true });
    for (const cell of part) occupancy[cellIndex(mask, cell.x, cell.y)] = newIndex;
    created++;
  }
  return created;
}
