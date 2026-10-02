import { maskFromAscii } from '../board/mask.ts';
import type { Mask } from '../board/types.ts';

/**
 * A pixel-art board for events, as text: `.` is transparent, every other
 * character is a colour named in the legend. Claude Design produces the art
 * as a small PNG; the app converts it to this form (or feeds `maskFromPixels`).
 */
export interface Drawing {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly string[];
  readonly legend: Readonly<Record<string, string>>;
}

export const HEART: Drawing = {
  id: 'heart',
  name: 'Heart',
  legend: { H: 'red' },
  rows: [
    '..HHH...HHH..',
    '.HHHHH.HHHHH.',
    'HHHHHHHHHHHHH',
    'HHHHHHHHHHHHH',
    'HHHHHHHHHHHHH',
    '.HHHHHHHHHHH.',
    '..HHHHHHHHH..',
    '...HHHHHHH...',
    '....HHHHH....',
    '.....HHH.....',
    '......H......',
  ],
};

export const BUTTERFLY: Drawing = {
  id: 'butterfly',
  name: 'Butterfly',
  legend: { O: 'orange', Y: 'yellow', B: 'brown' },
  rows: [
    '....OOO.......OOO....',
    '..OOOOOO.....OOOOOO..',
    '.OOOOOOOO...OOOOOOOO.',
    '.OOOOOOOOO.OOOOOOOOO.',
    '.OOOOOOOOOBOOOOOOOOO.',
    '..OOOOOOOOBOOOOOOOO..',
    '...OOOOOOOBOOOOOOO...',
    '....OOOOOOBOOOOOO....',
    '...YYYYYYOBOYYYYYY...',
    '..YYYYYYYYBYYYYYYYY..',
    '..YYYYYYYYBYYYYYYYY..',
    '...YYYYYYYBYYYYYYY...',
    '....YYYYYYBYYYYYY....',
    '.....YYYY.B.YYYY.....',
    '......YY..B..YY......',
  ],
};

export const DRAWINGS: readonly Drawing[] = [HEART, BUTTERFLY];

export function drawingMask(drawing: Drawing): Mask {
  return maskFromAscii(drawing.rows, drawing.legend);
}

export function findDrawing(id: string): Drawing | undefined {
  return DRAWINGS.find((drawing) => drawing.id === id);
}
