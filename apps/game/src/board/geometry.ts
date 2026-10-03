import { DELTA, directionBetween } from '@arrows/engine';
import type { Arrow, Cell, Direction, Mask } from '@arrows/engine';
import type { BoardStyle, ThemeMotion } from '../theme/theme.ts';

/**
 * Board geometry in cell units: cell (x, y) covers [x, x+1] by [y, y+1]. The
 * renderer scales this to the screen, so nothing here knows about pixels.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function cellCenter(cell: Cell): Point {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

export function offset(point: Point, direction: Direction, amount: number): Point {
  const { dx, dy } = DELTA[direction];
  return { x: point.x + dx * amount, y: point.y + dy * amount };
}

/** Drops points that lie on the straight line between their neighbours. */
export function simplify(points: readonly Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * The body line: from just behind the tail cell's centre, through every cell
 * centre, to just past the head's centre, under the arrowhead. Lines run
 * through cell centres, so two parallel paths in neighbouring cells are a full
 * cell apart and never touch.
 */
export function bodyPoints(arrow: Arrow, style: BoardStyle): Point[] {
  const { cells, direction } = arrow;
  const first = cells[0]!;
  const tailDirection = cells.length > 1 ? directionBetween(first, cells[1]!) : direction;
  const points: Point[] = [offset(cellCenter(first), tailDirection, -style.tailReach)];
  for (const cell of cells) points.push(cellCenter(cell));
  points.push(offset(cellCenter(cells[cells.length - 1]!), direction, style.bodyEnd));
  return simplify(points);
}

/** The arrowhead triangle: tip, then the two base corners. */
export function headPoints(arrow: Arrow, style: BoardStyle): Point[] {
  const centre = cellCenter(arrow.cells[arrow.cells.length - 1]!);
  const tip = offset(centre, arrow.direction, style.headTip);
  const base = offset(centre, arrow.direction, style.headTip - style.headDepth);
  const { dx, dy } = DELTA[arrow.direction];
  // Perpendicular to the direction.
  const px = -dy * style.headHalfWidth;
  const py = dx * style.headHalfWidth;
  return [tip, { x: base.x + px, y: base.y + py }, { x: base.x - px, y: base.y - py }];
}

export function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return length;
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** An open polyline as SVG path data. */
export function pathData(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('');
}

/** A closed polygon as SVG path data. */
export function polygonData(points: readonly Point[]): string {
  return `${pathData(points)}Z`;
}

export interface ExitTrack {
  /** The body line followed by the straight run out of the board. */
  readonly points: readonly Point[];
  /** Length of the body line: the visible part of the track at any moment. */
  readonly bodyLength: number;
  /** How far the arrow moves until its tail is past the edge of the board. */
  readonly travel: number;
}

/**
 * The path an arrow follows when it leaves: the body slides along itself,
 * then along the ray, so the head moves in a straight line and the rest of
 * the body follows the head's track, the way the reference game animates it.
 */
export function exitTrack(arrow: Arrow, style: BoardStyle, rayLength: number): ExitTrack {
  const body = bodyPoints(arrow, style);
  const bodyLength = polylineLength(body);
  const travel = bodyLength + rayLength + 1.5;
  const end = offset(body[body.length - 1]!, arrow.direction, travel);
  return { points: simplify([...body, end]), bodyLength, travel };
}

export function exitDuration(travel: number, motion: ThemeMotion): number {
  const ms = motion.exitMinMs + travel * motion.exitMsPerCell;
  return Math.min(motion.exitMaxMs, Math.max(motion.exitMinMs, ms));
}

/** Cell grid lines for the active cells, each edge drawn once. */
export function gridData(mask: Mask): string {
  const active = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.active[y * mask.width + x] === 1;
  const parts: string[] = [];
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (!active(x, y)) continue;
      parts.push(`M${x} ${y}h1`, `M${x} ${y}v1`);
      if (!active(x + 1, y)) parts.push(`M${x + 1} ${y}v1`);
      if (!active(x, y + 1)) parts.push(`M${x} ${y + 1}h1`);
    }
  }
  return parts.join('');
}

export function boardBounds(width: number, height: number, margin: number): Bounds {
  return { minX: -margin, minY: -margin, maxX: width + margin, maxY: height + margin };
}
