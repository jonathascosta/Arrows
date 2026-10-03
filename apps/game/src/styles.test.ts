import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('styles.css', () => {
  it('holds no colour literal: colours come from the theme', () => {
    const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8')
      // Comments may talk about colours.
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = css.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch|oklab)a?\(/g) ?? [];
    expect(literals).toEqual([]);
  });
});
