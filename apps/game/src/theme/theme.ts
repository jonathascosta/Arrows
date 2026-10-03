import type { Tier } from '@arrows/engine';

/**
 * Everything a screen needs to look the way it does. Code reads colours,
 * strokes, fonts, icons and timings from here and nowhere else (a lint rule
 * and a test keep colour literals inside `src/theme/`), so a new theme is a
 * new object, not a code change.
 */
export interface ThemeColors {
  readonly background: string;
  /** Pills and quiet surfaces, like the timer. */
  readonly surface: string;
  /** Raised surfaces: the grid button, overlay cards. */
  readonly surfaceRaised: string;
  readonly shadow: string;
  readonly text: string;
  readonly textMuted: string;
  readonly title: string;
  readonly divider: string;
  /** Arrows on plain boards. Drawings colour arrows from `drawingPalette`. */
  readonly stroke: string;
  readonly hint: string;
  readonly blocked: string;
  readonly grid: string;
  readonly drop: string;
  readonly dropEmpty: string;
  readonly scrim: string;
  readonly button: string;
  readonly buttonText: string;
  readonly focus: string;
}

/** Arrow geometry, in cell units (a cell is 1 by 1). */
export interface BoardStyle {
  readonly strokeWidth: number;
  /** How far the tail reaches back from its cell centre. */
  readonly tailReach: number;
  /** Arrowhead tip, measured from the head cell centre. */
  readonly headTip: number;
  /** Arrowhead length from base to tip. */
  readonly headDepth: number;
  readonly headHalfWidth: number;
  /** Where the body line ends, past the head centre and under the arrowhead. */
  readonly bodyEnd: number;
  readonly gridWidth: number;
  /** Empty space around the board, so arrowheads at the edge are not clipped. */
  readonly margin: number;
}

export interface ThemeIcons {
  readonly back: string;
  readonly drop: string;
  readonly clock: string;
  readonly hint: string;
  readonly grid: string;
}

export interface ThemeMotion {
  readonly exitMinMs: number;
  readonly exitMaxMs: number;
  /** Extra exit time per cell travelled, before clamping to the range. */
  readonly exitMsPerCell: number;
  readonly shakeMs: number;
  /** Pause between the last arrow leaving and the win overlay. */
  readonly settleMs: number;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly colors: ThemeColors;
  readonly tiers: Readonly<Record<Tier, string>>;
  /** Drawing palette names (from the drawing's legend) to colours. */
  readonly drawingPalette: Readonly<Record<string, string>>;
  readonly board: BoardStyle;
  readonly fonts: { readonly ui: string };
  /** Inline SVG markup drawn with `currentColor`. */
  readonly icons: ThemeIcons;
  readonly motion: ThemeMotion;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The CSS custom properties a theme defines, by name. */
export function themeProperties(theme: Theme): Record<string, string> {
  const properties: Record<string, string> = {};
  // ThemeColors is an interface, so entries come back untyped; every value is a string.
  for (const [name, value] of Object.entries(theme.colors) as [string, string][]) {
    properties[`--color-${kebab(name)}`] = value;
  }
  for (const [tier, value] of Object.entries(theme.tiers)) {
    properties[`--tier-${kebab(tier)}`] = value;
  }
  properties['--font-ui'] = theme.fonts.ui;
  return properties;
}

/** Writes the theme into CSS custom properties on `root` and the browser's theme colour. */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  for (const [name, value] of Object.entries(themeProperties(theme))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.id;
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme.colors.background);
}

const CSS_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|oklab)a?\(.*\))$/i;

/**
 * The colour of an arrow whose cells have palette entry `entry`: the theme's
 * colour for that name, the entry itself when it already is a CSS colour
 * (a drawing decoded from a PNG), or the plain stroke.
 */
export function arrowColor(theme: Theme, entry: string | undefined): string {
  if (entry === undefined) return theme.colors.stroke;
  const named = theme.drawingPalette[entry];
  if (named !== undefined) return named;
  return CSS_COLOR.test(entry) ? entry : theme.colors.stroke;
}
