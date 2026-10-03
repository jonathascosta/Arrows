import { DELTA, directionBetween } from '../board/direction.ts';
import type { Direction } from '../board/direction.ts';
import { cellIndex, inBounds } from '../board/mask.ts';
import type { Arrow, Cell, Mask } from '../board/types.ts';

/**
 * Where the ends of an arrow are drawn. The tip sits on the head cell's
 * forward edge; the tail's end sits on the tail cell's back edge, opposite the
 * way the arrow leaves the tail (for a one-cell arrow, opposite its
 * direction). Body corners sit on cell centres, so two arrows can only share a
 * drawing node through their ends, on the edge between two cells.
 */
export interface EndNodes {
  /** Edge keys (see `edgeKey`), or -1 when the end sits on the board's border. */
  readonly tip: number;
  readonly tail: number;
}

/** The edge between two adjacent cells, as one number; -1 when `b` is off the board. */
export function edgeKey(mask: Pick<Mask, 'width' | 'height'>, a: Cell, b: Cell): number {
  if (!inBounds(mask, b.x, b.y)) return -1;
  const i = cellIndex(mask, a.x, a.y);
  const j = cellIndex(mask, b.x, b.y);
  return Math.min(i, j) * mask.width * mask.height + Math.max(i, j);
}

/** The direction an arrow leaves its tail cell in. */
export function tailDirection(cells: readonly Cell[], direction: Direction): Direction {
  return cells.length === 1 ? direction : directionBetween(cells[0]!, cells[1]!);
}

export function endNodes(
  mask: Pick<Mask, 'width' | 'height'>,
  cells: readonly Cell[],
  direction: Direction,
): EndNodes {
  const head = cells[cells.length - 1]!;
  const forward = DELTA[direction];
  const tail = cells[0]!;
  const out = DELTA[tailDirection(cells, direction)];
  return {
    tip: edgeKey(mask, head, { x: head.x + forward.dx, y: head.y + forward.dy }),
    tail: edgeKey(mask, tail, { x: tail.x - out.dx, y: tail.y - out.dy }),
  };
}

export type EndConflict = 'tipToTail' | 'tailToTail' | 'tipToTip';

/** Every pair of arrows whose ends share an edge node, with the kind of conflict. */
export function endConflicts(
  mask: Pick<Mask, 'width' | 'height'>,
  arrows: readonly Pick<Arrow, 'cells' | 'direction'>[],
): { a: number; b: number; kind: EndConflict }[] {
  const seen = new Map<number, { arrow: number; tip: boolean }>();
  const conflicts: { a: number; b: number; kind: EndConflict }[] = [];
  arrows.forEach((arrow, i) => {
    const { tip, tail } = endNodes(mask, arrow.cells, arrow.direction);
    for (const [key, isTip] of [
      [tip, true],
      [tail, false],
    ] as const) {
      if (key === -1) continue;
      const other = seen.get(key);
      if (other === undefined) {
        seen.set(key, { arrow: i, tip: isTip });
        continue;
      }
      const kind: EndConflict =
        isTip && other.tip ? 'tipToTip' : isTip || other.tip ? 'tipToTail' : 'tailToTail';
      // For a tip to a tail, `a` is the arrow whose tip it is.
      const [a, b] = other.tip && !isTip ? [other.arrow, i] : [i, other.arrow];
      conflicts.push({ a, b, kind });
    }
  });
  return conflicts;
}

export interface SeparatedEnds {
  /** Tail first, head last, in removal order. */
  readonly arrows: { cells: Cell[]; direction: Direction; color: number }[];
  /** Arrows absorbed into another one (tip to tail) and tails moved (tail to tail). */
  readonly merges: number;
  readonly transfers: number;
  /** Conflicts left because the two arrows have different colours. */
  readonly left: number;
}

/**
 * Makes every drawing node serve one arrow end at most. `arrows` are in
 * removal order (a solution). Cells only ever move to an arrow that leaves
 * earlier, whose ray never crossed them (they were occupied when it left), so
 * the order stays a solution: every later move sees the same cells or fewer.
 *
 * - Tip to tail: A points into B's tail and B runs on in A's direction. B
 *   blocks A, so B leaves first; A is joined in front of B's tail and leaves
 *   with B.
 * - Tail to tail: two tails back to back in one line. The arrow that leaves
 *   later gives its straight run of tail cells, up to its first turn, to the
 *   other; its new tail then leaves sideways. With no turn, or when that new
 *   tail would land on another end, it gives all, which adds no new node.
 * - Tip to tip cannot happen in a solvable puzzle.
 *
 * Each step moves cells to earlier arrows, so it ends. Arrows of different
 * colours (on a drawing) are never joined; such a conflict is counted in `left`,
 * and the peel avoids making them.
 */
export function separateEnds(
  mask: Pick<Mask, 'width' | 'height'>,
  inOrder: readonly { cells: readonly Cell[]; direction: Direction; color: number }[],
): SeparatedEnds {
  let arrows = inOrder.map((arrow) => ({
    cells: [...arrow.cells],
    direction: arrow.direction,
    color: arrow.color,
  }));
  let merges = 0;
  let transfers = 0;
  for (;;) {
    const conflict = endConflicts(mask, arrows).find(
      ({ a, b }) => arrows[a]!.color === arrows[b]!.color,
    );
    if (conflict === undefined) break;
    const { a, b, kind } = conflict;
    if (kind === 'tipToTip') throw new Error('separateEnds: tip to tip; the puzzle is unsolvable');
    if (kind === 'tipToTail') {
      // `a` points into `b`'s tail, so `b` leaves first.
      if (b > a) throw new Error('separateEnds: a tip into a tail that leaves later');
      const into = arrows[b]!;
      into.cells = [...arrows[a]!.cells, ...into.cells];
      arrows = arrows.filter((_, i) => i !== a);
      merges++;
      continue;
    }
    const [early, late] = a < b ? [a, b] : [b, a];
    const giver = arrows[late]!;
    const taker = arrows[early]!;
    const out = tailDirection(giver.cells, giver.direction);
    const k = giver.cells.length - 1;
    let m = 1;
    while (m < k && directionBetween(giver.cells[m]!, giver.cells[m + 1]!) === out) m++;
    let give = m < k ? m : giver.cells.length;
    if (give < giver.cells.length) {
      // The giver's new tail must not land on another end; if it would, it gives all.
      const newTail = endNodes(mask, giver.cells.slice(give), giver.direction).tail;
      const taken = arrows.some((arrow) => {
        const nodes = endNodes(mask, arrow.cells, arrow.direction);
        return newTail !== -1 && (nodes.tip === newTail || nodes.tail === newTail);
      });
      if (taken) give = giver.cells.length;
    }
    taker.cells = [...giver.cells.slice(0, give).reverse(), ...taker.cells];
    if (give === giver.cells.length) {
      arrows = arrows.filter((_, i) => i !== late);
      merges++;
    } else {
      giver.cells = giver.cells.slice(give);
      transfers++;
    }
  }
  const left = endConflicts(mask, arrows).length;
  return { arrows, merges, transfers, left };
}
