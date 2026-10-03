import { DELTA, DIRECTIONS, directionBetween } from '../board/direction.ts';
import type { Direction } from '../board/direction.ts';
import { cellIndex, inBounds } from '../board/mask.ts';
import type { Arrow, Cell, Mask, Path, RayMode } from '../board/types.ts';
import type { Rng } from '../rng/rng.ts';
import { rayStatus } from '../solver/occupancy.ts';
import { endNodes } from './ends.ts';

export interface PeelOptions {
  /**
   * 0 picks the next arrow to peel uniformly among the free ones; 1 always
   * picks one with the longest ray. Higher means heads deeper inside the board
   * and fewer obvious moves, so a harder puzzle. With `freshness`, it only
   * breaks ties between the best-scored ends.
   */
  readonly bias: number;
  /**
   * Scores the free ends instead of picking among them at random. An arrow is
   * free in the finished puzzle from the removal that clears its head's ray
   * until it leaves, so each step peels the end whose ray was cleared most
   * recently; this is the weight per removal of age. 0 or absent: off, and
   * every option below is ignored.
   */
  readonly freshness?: number;
  /**
   * Score taken off an end whose ray was cleared by an arrow pointing the same
   * way: removing one obviously frees the one behind it (a queue).
   */
  readonly queuePenalty?: number;
  /**
   * Score added to an end whose path is committed: its other end is free too,
   * or blocked by its own body, so waiting cannot give it a later head and only
   * keeps it free longer. Large values peel committed paths first.
   */
  readonly commitment?: number;
  /**
   * When the best end was cleared more than this many removals before the
   * last one, cut a path in two instead, if the cut leaves an end that scores
   * better (both pieces at least `cutMinPiece` long). Absent: never.
   */
  readonly staleCut?: number;
  /** Shortest piece a cut may leave (default 2). */
  readonly cutMinPiece?: number;
  /**
   * When nothing can be peeled: `top` (default) cuts the topmost cell out as a
   * single pointing up; `cut` first cuts one path in two so that a new end is
   * free, keeping the pieces long, and falls back to `top`.
   */
  readonly repair?: 'top' | 'cut';
}

export interface PeelResult {
  /** Ids are assigned by head position (top to bottom, left to right). */
  readonly arrows: readonly Arrow[];
  /** Arrow ids in an order that solves the puzzle. */
  readonly solution: readonly number[];
  /** Paths that had to be split: nothing could be peeled, or a fresh cut. */
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

  const freshness = options.freshness ?? 0;
  const queuePenalty = options.queuePenalty ?? 0;
  const commitment = options.commitment ?? 0;
  // The removal (1, 2, ...) that vacated each cell; 0 while occupied or never.
  const vacatedBy = new Int32Array(mask.width * mask.height);
  const removedDirection: Direction[] = [];
  // On a drawing: the drawing nodes taken by arrow ends, with their colour.
  const multicolor = new Set(paths.map((path) => path.color)).size > 1;
  const peeledNodes = new Map<number, number>();
  /** How recently the ray became clear, minus the queue penalty. Higher is better. */
  const freshScore = (from: Cell, direction: Direction): number => {
    const { dx, dy } = DELTA[direction];
    let x = from.x + dx;
    let y = from.y + dy;
    let since = 0;
    while (inBounds(mask, x, y)) {
      const index = cellIndex(mask, x, y);
      if (rayMode === 'mask' && mask.active[index] !== 1) break;
      since = Math.max(since, vacatedBy[index]!);
      x += dx;
      y += dy;
    }
    const queue = since > 0 && removedDirection[since - 1] === direction;
    return freshness * (since - peeled.length) - (queue ? queuePenalty : 0);
  };

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
      const cut =
        options.repair === 'cut'
          ? cutForFreeEnd(mask, pieces, occupancy, rng, rayMode, () => 0, -1, 1)
          : false;
      if (!cut) repair(mask, pieces, occupancy);
      remaining = pieces.filter((piece) => piece.alive).length;
      repairs++;
      continue;
    }

    // On a drawing, keep ends off the nodes of ends of another colour: two
    // ends on one node are joined after the peel, which needs one colour. A
    // path's end nodes are fixed whichever end leads; a single's are not.
    let pool = candidates;
    if (multicolor) {
      const nodes = new Map(peeledNodes);
      for (const piece of pieces) {
        if (!piece.alive || piece.cells.length < 2) continue;
        const { tip, tail } = endNodes(
          mask,
          piece.cells,
          directionBetween(
            piece.cells[piece.cells.length - 2]!,
            piece.cells[piece.cells.length - 1]!,
          ),
        );
        nodes.set(tip, piece.color);
        nodes.set(tail, piece.color);
      }
      const clean = candidates.filter((candidate) => {
        const piece = pieces[candidate.piece]!;
        const cells = candidate.headAtStart ? [...piece.cells].reverse() : piece.cells;
        const { tip, tail } = endNodes(mask, cells, candidate.direction);
        const tipColor = nodes.get(tip);
        const tailColor = nodes.get(tail);
        return (
          (tip === -1 || tipColor === undefined || tipColor === piece.color) &&
          (tail === -1 || tailColor === undefined || tailColor === piece.color)
        );
      });
      if (clean.length > 0) pool = clean;
    }
    if (freshness > 0) {
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestCommitted = false;
      const scored = pool;
      pool = [];
      for (const candidate of scored) {
        const { cells } = pieces[candidate.piece]!;
        const end = candidate.headAtStart ? cells[0]! : cells[cells.length - 1]!;
        const committed =
          commitment > 0 && isCommitted(mask, occupancy, pieces, candidates, candidate, rayMode);
        const score = freshScore(end, candidate.direction) + (committed ? commitment : 0);
        if (score > bestScore) {
          bestScore = score;
          bestCommitted = committed;
          pool = [candidate];
        } else if (score === bestScore) {
          pool.push(candidate);
        }
      }
      if (
        options.staleCut !== undefined &&
        !bestCommitted &&
        bestScore < -freshness * options.staleCut &&
        cutForFreeEnd(
          mask,
          pieces,
          occupancy,
          rng,
          rayMode,
          freshScore,
          bestScore,
          options.cutMinPiece ?? 2,
        )
      ) {
        remaining++;
        repairs++;
        continue;
      }
    }

    const chosen = choose(pool, rng, options.bias);
    const piece = pieces[chosen.piece]!;
    const cells = chosen.headAtStart ? [...piece.cells].reverse() : [...piece.cells];
    for (const cell of cells) occupancy[cellIndex(mask, cell.x, cell.y)] = -1;
    piece.alive = false;
    remaining--;
    peeled.push({ cells, direction: chosen.direction, color: piece.color });
    for (const cell of cells) vacatedBy[cellIndex(mask, cell.x, cell.y)] = peeled.length;
    removedDirection.push(chosen.direction);
    if (multicolor) {
      const { tip, tail } = endNodes(mask, cells, chosen.direction);
      peeledNodes.set(tip, piece.color);
      peeledNodes.set(tail, piece.color);
    }
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
 * Whether a candidate's path gains nothing by waiting: every other head it
 * could get is free already, or blocked by its own body for good.
 */
function isCommitted(
  mask: Mask,
  occupancy: Int32Array,
  pieces: readonly Piece[],
  candidates: readonly Candidate[],
  candidate: Candidate,
  rayMode: RayMode,
): boolean {
  const { cells } = pieces[candidate.piece]!;
  const free = candidates.filter((c) => c.piece === candidate.piece).length;
  if (cells.length === 1) return free === DIRECTIONS.length;
  if (free === 2) return true;
  const other = candidate.headAtStart ? cells.length - 1 : 0;
  const before = candidate.headAtStart ? cells.length - 2 : 1;
  const from = cells[other]!;
  const { dx, dy } = DELTA[directionBetween(cells[before]!, from)];
  let x = from.x + dx;
  let y = from.y + dy;
  while (inBounds(mask, x, y)) {
    const index = cellIndex(mask, x, y);
    if (rayMode === 'mask' && mask.active[index] !== 1) return false;
    if (occupancy[index] === candidate.piece) return true;
    x += dx;
    y += dy;
  }
  return false;
}

/**
 * Cuts one path in two so that a new end at the cut is free and scores above
 * `above`: the best score, then the longest shorter piece. Both pieces keep at
 * least `minPiece` cells; with 1, a path may lose an end cell. Returns whether
 * it cut.
 */
function cutForFreeEnd(
  mask: Mask,
  pieces: Piece[],
  occupancy: Int32Array,
  rng: Rng,
  rayMode: RayMode,
  scoreOf: (end: Cell, direction: Direction) => number,
  above: number,
  minPiece: number,
): boolean {
  let bestScore = above;
  let bestShorter = 0;
  let best: { piece: number; at: number }[] = [];
  const consider = (piece: number, at: number, shorter: number, end: Cell, d: Direction) => {
    if (rayStatus(mask, occupancy, end, d, rayMode).blockers !== 0) return;
    const score = scoreOf(end, d);
    if (score < bestScore || (score === bestScore && shorter < bestShorter)) return;
    if (score > bestScore || shorter > bestShorter) {
      best = [];
      bestScore = score;
      bestShorter = shorter;
    }
    best.push({ piece, at });
  };
  pieces.forEach((piece, i) => {
    if (!piece.alive) return;
    const { cells } = piece;
    for (let at = minPiece; at <= cells.length - minPiece; at++) {
      const shorter = Math.min(at, cells.length - at);
      // The new ends: the last cell of the first piece, the first of the second.
      const left = cells[at - 1]!;
      const right = cells[at]!;
      if (at === 1) {
        for (const d of DIRECTIONS) consider(i, at, shorter, left, d);
      } else {
        consider(i, at, shorter, left, directionBetween(cells[at - 2]!, left));
      }
      if (at === cells.length - 1) {
        for (const d of DIRECTIONS) consider(i, at, shorter, right, d);
      } else {
        consider(i, at, shorter, right, directionBetween(cells[at + 1]!, right));
      }
    }
  });
  if (best.length === 0 || bestScore <= above) return false;
  const { piece: pieceIndex, at } = rng.pick(best);
  const piece = pieces[pieceIndex]!;
  const tail = piece.cells.slice(at);
  piece.cells = piece.cells.slice(0, at);
  const newIndex = pieces.length;
  pieces.push({ cells: tail, color: piece.color, alive: true });
  for (const cell of tail) occupancy[cellIndex(mask, cell.x, cell.y)] = newIndex;
  return true;
}

/**
 * Cuts the topmost (then leftmost) occupied cell out of its path. It becomes
 * a single cell; what came before and after it in the path become paths of
 * their own. Pointing up, the single has nothing above it, so the next round
 * has at least one candidate in either ray mode.
 */
function repair(mask: Mask, pieces: Piece[], occupancy: Int32Array): void {
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
  for (const part of [before, after]) {
    if (part.length === 0) continue;
    const newIndex = pieces.length;
    pieces.push({ cells: part, color: piece.color, alive: true });
    for (const cell of part) occupancy[cellIndex(mask, cell.x, cell.y)] = newIndex;
  }
}
