import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DRAWINGS } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './default.ts';
import { applyTheme, arrowColors, themeProperties } from './theme.ts';

describe('theme', () => {
  it('exposes every colour, tier, avatar, shadow, font and the emphasis stroke as CSS properties', () => {
    const properties = themeProperties(DEFAULT_THEME);
    expect(properties['--color-background']).toBe(DEFAULT_THEME.colors.background);
    expect(properties['--color-surface-raised']).toBe(DEFAULT_THEME.colors.surfaceRaised);
    expect(properties['--color-chance-lost']).toBe(DEFAULT_THEME.colors.chanceLost);
    expect(properties['--color-on-primary']).toBe(DEFAULT_THEME.colors.onPrimary);
    expect(properties['--tier-super-hard']).toBe(DEFAULT_THEME.tiers.superHard);
    expect(properties['--shadow-raised']).toBe(DEFAULT_THEME.shadows.raised);
    expect(properties['--font-title']).toBe(DEFAULT_THEME.fonts.title);
    expect(properties['--font-ui']).toBe(DEFAULT_THEME.fonts.ui);
    expect(properties['--avatar-0']).toBe(DEFAULT_THEME.avatars[0]);
    expect(properties['--board-emphasis-width']).toBe(`${DEFAULT_THEME.board.emphasisWidth}px`);
    expect(Object.keys(properties)).toHaveLength(
      Object.keys(DEFAULT_THEME.colors).length +
        Object.keys(DEFAULT_THEME.tiers).length +
        DEFAULT_THEME.avatars.length +
        4,
    );
  });

  it('applies to a root element and the theme-color meta', () => {
    document.head.innerHTML = '<meta name="theme-color" content="">';
    applyTheme(DEFAULT_THEME, document.documentElement);
    expect(document.documentElement.style.getPropertyValue('--color-stroke')).toBe(
      DEFAULT_THEME.colors.stroke,
    );
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME.id);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      DEFAULT_THEME.colors.background,
    );
  });

  it('colours drawing arrows by palette name or CSS colour, body and head alike', () => {
    const orange = DEFAULT_THEME.drawingPalette.orange!;
    expect(arrowColors(DEFAULT_THEME, 'orange')).toEqual({ body: orange, head: orange });
    expect(arrowColors(DEFAULT_THEME, '#123456')).toEqual({ body: '#123456', head: '#123456' });
    expect(arrowColors(DEFAULT_THEME, 'rgb(1, 2, 3)')).toEqual({
      body: 'rgb(1, 2, 3)',
      head: 'rgb(1, 2, 3)',
    });
  });

  it('colours plain-board arrows with the stroke and head tokens', () => {
    const plain = { body: DEFAULT_THEME.colors.stroke, head: DEFAULT_THEME.colors.head };
    expect(arrowColors(DEFAULT_THEME, 'default')).toEqual(plain);
    expect(arrowColors(DEFAULT_THEME, undefined)).toEqual(plain);
  });

  it('has a colour for every palette name the built-in drawings use', () => {
    for (const drawing of DRAWINGS) {
      for (const name of Object.values(drawing.legend)) {
        expect(DEFAULT_THEME.drawingPalette[name], `${drawing.id}: ${name}`).toBeDefined();
      }
    }
  });

  it('draws the art in its own colours: the PNG palette is the theme palette', () => {
    // A theme change to the drawing palette must come with the art redrawn (pnpm drawings).
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../../art/drawings/drawings.json'), 'utf8'),
    ) as { palette: Record<string, string> };
    const art = Object.fromEntries(
      Object.entries(manifest.palette).map(([hex, name]) => [name, hex.toLowerCase()]),
    );
    const theme = Object.fromEntries(
      Object.entries(DEFAULT_THEME.drawingPalette).map(([name, hex]) => [name, hex.toLowerCase()]),
    );
    expect(art).toEqual(theme);
  });

  it('uses the arrowhead of docs/DESIGN.md', () => {
    const { board } = DEFAULT_THEME;
    expect(board.strokeWidth).toBe(0.12);
    // The tip and the tail's round end on the cell's edge, a node of the grid.
    expect(board.headTip).toBe(0.5);
    expect(board.tailReach).toBe(0.44);
    expect(board.headDepth).toBe(0.42);
    expect(board.headHalfWidth * 2).toBeCloseTo(0.34);
  });
});
