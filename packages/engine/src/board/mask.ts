import type { Cell, Mask } from './types.ts';

export function cellIndex(mask: Pick<Mask, 'width'>, x: number, y: number): number {
  return y * mask.width + x;
}

export function inBounds(mask: Pick<Mask, 'width' | 'height'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < mask.width && y < mask.height;
}

export function isActive(mask: Mask, x: number, y: number): boolean {
  return inBounds(mask, x, y) && mask.active[cellIndex(mask, x, y)] === 1;
}

export function colorAt(mask: Mask, x: number, y: number): number {
  return mask.color[cellIndex(mask, x, y)]!;
}

/** Every active cell, row-major. */
export function activeCells(mask: Mask): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.active[cellIndex(mask, x, y)] === 1) cells.push({ x, y });
    }
  }
  return cells;
}

export function activeCount(mask: Mask): number {
  let n = 0;
  for (const value of mask.active) n += value;
  return n;
}

/** A full rectangle of one colour: the board of every ordinary level. */
export function rectangleMask(width: number, height: number): Mask {
  if (width < 1 || height < 1) throw new RangeError('A mask needs at least one cell');
  return {
    width,
    height,
    active: new Uint8Array(width * height).fill(1),
    color: new Uint8Array(width * height),
    palette: ['default'],
  };
}

/**
 * A mask from pixels, row-major: `null` for a transparent pixel, otherwise the
 * palette index. This is what the app feeds from a decoded PNG.
 */
export function maskFromPixels(
  width: number,
  height: number,
  pixels: readonly (number | null)[],
  palette: readonly string[],
): Mask {
  if (pixels.length !== width * height) {
    throw new RangeError(`Expected ${width * height} pixels, got ${pixels.length}`);
  }
  const active = new Uint8Array(width * height);
  const color = new Uint8Array(width * height);
  let count = 0;
  pixels.forEach((pixel, i) => {
    if (pixel === null) return;
    if (pixel < 0 || pixel >= palette.length || !Number.isInteger(pixel)) {
      throw new RangeError(`Pixel ${i} has palette index ${pixel}, palette has ${palette.length}`);
    }
    active[i] = 1;
    color[i] = pixel;
    count++;
  });
  if (count === 0) throw new RangeError('A mask needs at least one active cell');
  return { width, height, active, color, palette };
}

/**
 * A mask from ASCII art: `.` and space are transparent, any other character is a
 * colour, indexed in order of first appearance (or by `legend`). Handy for
 * fixtures and for drawings kept as text in the repository.
 */
export function maskFromAscii(
  rows: readonly string[],
  legend?: Readonly<Record<string, string>>,
): Mask {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  if (height === 0 || width === 0) throw new RangeError('Empty ASCII mask');
  const palette: string[] = [];
  const indexOf = new Map<string, number>();
  if (legend) {
    for (const [char, name] of Object.entries(legend)) {
      indexOf.set(char, palette.length);
      palette.push(name);
    }
  }
  const pixels: (number | null)[] = [];
  for (const row of rows) {
    for (let x = 0; x < width; x++) {
      const char = row[x] ?? '.';
      if (char === '.' || char === ' ') {
        pixels.push(null);
        continue;
      }
      let index = indexOf.get(char);
      if (index === undefined) {
        index = palette.length;
        indexOf.set(char, index);
        palette.push(char);
      }
      pixels.push(index);
    }
  }
  return maskFromPixels(width, height, pixels, palette);
}
