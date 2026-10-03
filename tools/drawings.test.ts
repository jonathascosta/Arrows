import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findDrawing } from '@arrows/engine';
import type { Drawing } from '@arrows/engine';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { constantName, drawingFromPng, drawingsModule, parseManifest } from './drawings.ts';
import type { ManifestDrawing } from './drawings.ts';

const root = resolve(import.meta.dirname, '..');
const artDir = join(root, 'art/drawings');
const target = join(root, 'packages/engine/src/drawings/art.ts');
const manifest = parseManifest(readFileSync(join(artDir, 'drawings.json'), 'utf8'));

/** A PNG of a drawing, one pixel per cell, in the manifest's palette. */
function pngOf(drawing: Drawing, alpha = 255): Buffer {
  const hexOf = new Map(Object.entries(manifest.palette).map(([hex, name]) => [name, hex]));
  const png = new PNG({ width: drawing.rows[0]!.length, height: drawing.rows.length });
  drawing.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row.charAt(x);
      const i = (y * png.width + x) * 4;
      if (char === '.') continue;
      const hex = hexOf.get(drawing.legend[char]!)!;
      png.data[i] = parseInt(hex.slice(1, 3), 16);
      png.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      png.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      png.data[i + 3] = alpha;
    }
  });
  return PNG.sync.write(png);
}

const entry = (overrides: Partial<ManifestDrawing> = {}): ManifestDrawing => ({
  id: 'test',
  name: 'Test',
  file: 'test.png',
  legend: { R: 'red', B: 'brown' },
  ...overrides,
});

describe('the art in the repository', () => {
  it('round-trips every PNG to the drawing checked in to the engine', () => {
    expect(manifest.drawings.map((drawing) => drawing.id)).toEqual([
      'heart',
      'butterfly',
      'maple-leaf',
      'acorn',
    ]);
    for (const item of manifest.drawings) {
      const drawing = drawingFromPng(readFileSync(join(artDir, item.file)), item, manifest.palette);
      expect(drawing, item.id).toEqual(findDrawing(item.id));
      // And back: the drawing drawn as a PNG reads as itself.
      expect(drawingFromPng(pngOf(drawing), item, manifest.palette)).toEqual(drawing);
    }
  });

  it('makes exactly the engine module that is checked in', async () => {
    const drawings = manifest.drawings.map((item) =>
      drawingFromPng(readFileSync(join(artDir, item.file)), item, manifest.palette),
    );
    expect(await drawingsModule(drawings, target)).toBe(readFileSync(target, 'utf8'));
  });

  it('keeps the palette the theme names', () => {
    expect(Object.values(manifest.palette).sort()).toEqual(
      ['black', 'blue', 'brown', 'green', 'orange', 'purple', 'red', 'yellow'].sort(),
    );
  });
});

describe('drawingFromPng', () => {
  const leaf: Drawing = {
    id: 'test',
    name: 'Test',
    legend: { R: 'red', B: 'brown' },
    rows: ['.R.', 'RRR', '.B.'],
  };

  it('reads transparent pixels as no cell and palette colours as their legend character', () => {
    expect(drawingFromPng(pngOf(leaf), entry(), manifest.palette)).toEqual(leaf);
  });

  it('names the pixel that is off the palette, half transparent or not in the legend', () => {
    const png = PNG.sync.read(pngOf(leaf));
    png.data[4 * 4 + 1] = 0x01; // (1, 1): the red with its green channel changed
    expect(() => drawingFromPng(PNG.sync.write(png), entry(), manifest.palette)).toThrow(
      'test.png (1, 1): #a80134 is not in the drawing palette',
    );
    expect(() => drawingFromPng(pngOf(leaf, 128), entry(), manifest.palette)).toThrow(
      'test.png (1, 0): half transparent (alpha 128)',
    );
    expect(() =>
      drawingFromPng(pngOf(leaf), entry({ legend: { R: 'red' } }), manifest.palette),
    ).toThrow('test.png (1, 2): brown is not in the legend');
    expect(() =>
      drawingFromPng(
        pngOf(leaf),
        entry({ legend: { R: 'red', B: 'brown', G: 'green' } }),
        manifest.palette,
      ),
    ).toThrow('test.png: legend "G" is never drawn');
  });
});

describe('parseManifest', () => {
  it('rejects a manifest it cannot trust', () => {
    expect(() => parseManifest('{}')).toThrow('expected { palette, drawings }');
    expect(() => parseManifest('{"palette":{"#ZZZ":"red"},"drawings":[]}')).toThrow('bad colour');
    expect(() => parseManifest('{"palette":{},"drawings":[{"id":"Bad Id"}]}')).toThrow(
      'drawing 0 needs an id, a name, a file and a legend',
    );
    expect(() =>
      parseManifest(
        '{"palette":{},"drawings":[{"id":"a","name":"A","file":"a.png","legend":{".":"red"}}]}',
      ),
    ).toThrow('legend key "." must be one character');
    const drawing = (id: string): string =>
      `{"id":"${id}","name":"A","file":"a.png","legend":{"A":"red"}}`;
    expect(() =>
      parseManifest(`{"palette":{},"drawings":[${drawing('leaf')},${drawing('leaf')}]}`),
    ).toThrow('the id "leaf" is taken (it would be LEAF)');
    expect(() => parseManifest(`{"palette":{},"drawings":[${drawing('art')}]}`)).toThrow(
      'the id "art" is taken (it would be ART)',
    );
  });
});

describe('constantName', () => {
  it('turns an id into a constant', () => {
    expect(constantName('maple-leaf')).toBe('MAPLE_LEAF');
    expect(constantName('heart')).toBe('HEART');
  });
});
