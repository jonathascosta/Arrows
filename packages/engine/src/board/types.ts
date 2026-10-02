import type { Direction } from './direction.ts';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * The playable area. A plain level is a rectangle where every cell is active and
 * has colour 0. An event board is a pixel-art drawing: inactive cells are the
 * transparent pixels, and the colour of a cell is the palette index of its pixel.
 * Paths never cross a colour boundary, so the drawing stays visible in the arrows.
 */
export interface Mask {
  readonly width: number;
  readonly height: number;
  /** Row-major, 1 for an active cell. */
  readonly active: Uint8Array;
  /** Row-major palette index per cell (meaningful where active). */
  readonly color: Uint8Array;
  /** Palette entries, one name or CSS colour per index. The renderer maps them to a theme. */
  readonly palette: readonly string[];
}

/** A simple path on the grid, before it has a head. Cells are adjacent in order. */
export interface Path {
  readonly cells: readonly Cell[];
  readonly color: number;
}

/** A path with a head: the last cell, pointing `direction`. */
export interface Arrow {
  readonly id: number;
  /** Tail first, head last. */
  readonly cells: readonly Cell[];
  readonly direction: Direction;
  readonly color: number;
}

/**
 * What the ray in front of a head crosses before the arrow is out:
 *  - `bounds`: inactive cells are empty space; the ray runs to the edge of the
 *    bounding rectangle, so on a concave drawing an arrow can be blocked by a
 *    part of the drawing across a gap;
 *  - `mask`: the arrow is out as soon as the ray leaves the active cells.
 */
export type RayMode = 'bounds' | 'mask';

export interface Puzzle {
  readonly width: number;
  readonly height: number;
  readonly mask: Mask;
  readonly arrows: readonly Arrow[];
  readonly rayMode: RayMode;
  readonly seed: string;
}

export function head(arrow: Arrow): Cell {
  return arrow.cells[arrow.cells.length - 1]!;
}
