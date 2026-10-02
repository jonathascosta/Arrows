import { describe, expect, it } from 'vitest';
import {
  activeCells,
  activeCount,
  colorAt,
  isActive,
  maskFromAscii,
  maskFromPixels,
  rectangleMask,
} from './mask.ts';

describe('rectangleMask', () => {
  it('activates every cell with colour 0', () => {
    const mask = rectangleMask(3, 2);
    expect(activeCount(mask)).toBe(6);
    expect(activeCells(mask)).toHaveLength(6);
    expect(colorAt(mask, 2, 1)).toBe(0);
    expect(isActive(mask, 3, 0)).toBe(false);
  });
});

describe('maskFromAscii', () => {
  it('reads transparency and colours in order of appearance', () => {
    const mask = maskFromAscii(['.A.', 'BAB', '.A.']);
    expect(mask.width).toBe(3);
    expect(mask.height).toBe(3);
    expect(activeCount(mask)).toBe(5);
    expect(mask.palette).toEqual(['A', 'B']);
    expect(colorAt(mask, 1, 0)).toBe(0);
    expect(colorAt(mask, 0, 1)).toBe(1);
    expect(isActive(mask, 0, 0)).toBe(false);
  });

  it('pads short rows as transparent and honours a legend', () => {
    const mask = maskFromAscii(['WW', 'W'], { W: '#ffffff' });
    expect(activeCount(mask)).toBe(3);
    expect(mask.palette).toEqual(['#ffffff']);
  });
});

describe('maskFromPixels', () => {
  it('rejects a wrong pixel count, an index outside the palette and an empty mask', () => {
    expect(() => maskFromPixels(2, 2, [0, 0, 0], ['a'])).toThrow(RangeError);
    expect(() => maskFromPixels(1, 1, [1], ['a'])).toThrow(RangeError);
    expect(() => maskFromPixels(1, 1, [null], ['a'])).toThrow(RangeError);
  });
});
