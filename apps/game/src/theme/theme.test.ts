import { DRAWINGS } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './default.ts';
import { applyTheme, arrowColors, themeProperties } from './theme.ts';

describe('theme', () => {
  it('exposes every colour, tier, shadow and font as a CSS custom property', () => {
    const properties = themeProperties(DEFAULT_THEME);
    expect(properties['--color-background']).toBe(DEFAULT_THEME.colors.background);
    expect(properties['--color-surface-raised']).toBe(DEFAULT_THEME.colors.surfaceRaised);
    expect(properties['--color-chance-lost']).toBe(DEFAULT_THEME.colors.chanceLost);
    expect(properties['--color-on-primary']).toBe(DEFAULT_THEME.colors.onPrimary);
    expect(properties['--tier-super-hard']).toBe(DEFAULT_THEME.tiers.superHard);
    expect(properties['--shadow-raised']).toBe(DEFAULT_THEME.shadows.raised);
    expect(properties['--font-title']).toBe(DEFAULT_THEME.fonts.title);
    expect(properties['--font-ui']).toBe(DEFAULT_THEME.fonts.ui);
    expect(Object.keys(properties)).toHaveLength(
      Object.keys(DEFAULT_THEME.colors).length + Object.keys(DEFAULT_THEME.tiers).length + 3,
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

  it('uses the arrowhead of docs/DESIGN.md', () => {
    const { board } = DEFAULT_THEME;
    expect(board.strokeWidth).toBe(0.12);
    expect(board.headTip).toBe(0.42);
    expect(board.headDepth).toBe(0.42);
    expect(board.headHalfWidth * 2).toBeCloseTo(0.34);
  });
});
