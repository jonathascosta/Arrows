import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './default.ts';

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const { colors, tiers, drawingPalette } = DEFAULT_THEME;

/**
 * Every pairing the screens use, with the WCAG AA minimum for its role: 4.5:1
 * for body text, 3:1 for large text (the serif titles) and for icons and
 * strokes the player has to see.
 */
const PAIRS: [string, string, string, number][] = [
  ['text on background', colors.text, colors.background, 4.5],
  ['text on raised surface', colors.text, colors.surfaceRaised, 4.5],
  ['muted text on background', colors.textMuted, colors.background, 4.5],
  ['muted text on raised surface', colors.textMuted, colors.surfaceRaised, 4.5],
  ['title on background', colors.title, colors.background, 4.5],
  ['sheet title on raised surface', colors.title, colors.surfaceRaised, 4.5],
  ['button label on primary', colors.onPrimary, colors.primary, 4.5],
  ['back icon on surface', colors.text, colors.surface, 3],
  ['easy tier label', tiers.easy, colors.background, 4.5],
  ['medium tier label', tiers.medium, colors.background, 4.5],
  ['hard tier label', tiers.hard, colors.background, 4.5],
  ['super hard tier label', tiers.superHard, colors.background, 4.5],
  ['arrow stroke', colors.stroke, colors.background, 3],
  ['hinted arrow', colors.hint, colors.background, 3],
  ['blocked arrow', colors.blocked, colors.background, 3],
  ['intact chance', colors.chance, colors.background, 3],
  ['hint icon when shown', colors.hint, colors.surfaceRaised, 3],
  ['focus ring on background', colors.focus, colors.background, 3],
  ['focus ring on raised surface', colors.focus, colors.surfaceRaised, 3],
];

/**
 * Drawing colours come from the design and are not all strong enough for a
 * stroke on the paper background. The ones below 3:1 are listed here and in
 * docs/DESIGN.md (open points) so the gap stays visible; any other colour must
 * reach 3:1.
 */
const DRAWING_BELOW_3_TO_1 = new Set(['orange', 'yellow']);

describe('theme contrast (WCAG AA)', () => {
  it.each(PAIRS)('%s', (_name, foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it.each(Object.entries(drawingPalette))('drawing colour %s on the background', (name, color) => {
    const ratio = contrast(color, colors.background);
    if (DRAWING_BELOW_3_TO_1.has(name)) {
      // A known gap: the test fails if the colour is fixed, so the list gets updated.
      expect(ratio).toBeLessThan(3);
    } else {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps a lost chance quiet but present, and tells it apart by shape', () => {
    // Deliberately faint: the split shape, not the colour, carries "lost".
    const ratio = contrast(colors.chanceLost, colors.background);
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(3);
  });

  it('computes the reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
