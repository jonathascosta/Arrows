import { maskFromAscii } from '../board/mask.ts';
import type { Mask } from '../board/types.ts';
import { ART } from './art.ts';

/**
 * A pixel-art board for events, as text: `.` is transparent, every other
 * character is a colour named in the legend, in palette order. The art is a
 * small PNG in art/drawings; tools/png-to-drawing.ts converts it to this form
 * in `art.ts`.
 */
export interface Drawing {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly string[];
  readonly legend: Readonly<Record<string, string>>;
}

/** Every drawing: the PNG art of art/drawings, converted by `pnpm drawings`. */
export const DRAWINGS: readonly Drawing[] = ART;

export function drawingMask(drawing: Drawing): Mask {
  return maskFromAscii(drawing.rows, drawing.legend);
}

export function findDrawing(id: string): Drawing | undefined {
  return DRAWINGS.find((drawing) => drawing.id === id);
}
