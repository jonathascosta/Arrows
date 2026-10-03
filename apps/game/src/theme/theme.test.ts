import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './default.ts';
import { applyTheme, arrowColor, themeProperties } from './theme.ts';

describe('theme', () => {
  it('exposes every colour and tier as a CSS custom property', () => {
    const properties = themeProperties(DEFAULT_THEME);
    expect(properties['--color-background']).toBe(DEFAULT_THEME.colors.background);
    expect(properties['--color-surface-raised']).toBe(DEFAULT_THEME.colors.surfaceRaised);
    expect(properties['--tier-super-hard']).toBe(DEFAULT_THEME.tiers.superHard);
    expect(properties['--font-ui']).toBe(DEFAULT_THEME.fonts.ui);
    expect(Object.keys(properties)).toHaveLength(
      Object.keys(DEFAULT_THEME.colors).length + Object.keys(DEFAULT_THEME.tiers).length + 1,
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

  it('colours arrows by palette name, by CSS colour, or with the plain stroke', () => {
    expect(arrowColor(DEFAULT_THEME, 'orange')).toBe(DEFAULT_THEME.drawingPalette.orange);
    expect(arrowColor(DEFAULT_THEME, '#123456')).toBe('#123456');
    expect(arrowColor(DEFAULT_THEME, 'rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(arrowColor(DEFAULT_THEME, 'default')).toBe(DEFAULT_THEME.colors.stroke);
    expect(arrowColor(DEFAULT_THEME, undefined)).toBe(DEFAULT_THEME.colors.stroke);
  });

  it('has a colour for every palette name the built-in drawings use', async () => {
    const { DRAWINGS } = await import('@arrows/engine');
    for (const drawing of DRAWINGS) {
      for (const name of Object.values(drawing.legend)) {
        expect(DEFAULT_THEME.drawingPalette[name], `${drawing.id}: ${name}`).toBeDefined();
      }
    }
  });
});
