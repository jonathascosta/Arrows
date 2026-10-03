import type { Tier } from '@arrows/engine';

/**
 * Everything a screen needs to look the way it does. Code reads colours,
 * strokes, fonts, icons and timings from here and nowhere else (a lint rule
 * and a test keep colour literals inside `src/theme/`), so a new theme is a
 * new object, not a code change.
 */
export interface ThemeColors {
  readonly background: string;
  /** Quiet surfaces: round back buttons, chips, day cells. */
  readonly surface: string;
  /** Raised surfaces: cards, sheets, tool bar buttons. */
  readonly surfaceRaised: string;
  readonly text: string;
  readonly textMuted: string;
  readonly title: string;
  readonly divider: string;
  /** Arrow bodies on plain boards. Drawings colour arrows from `drawingPalette`. */
  readonly stroke: string;
  /** Arrowheads on plain boards. */
  readonly head: string;
  readonly hint: string;
  readonly blocked: string;
  readonly grid: string;
  /** An intact chance. */
  readonly chance: string;
  /** A lost chance, and the faded board after a loss. */
  readonly chanceLost: string;
  readonly primary: string;
  readonly onPrimary: string;
  /** Keyboard focus ring. */
  readonly focus: string;
}

/** Full CSS `box-shadow` values. */
export interface ThemeShadows {
  readonly raised: string;
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
  readonly hint: string;
  readonly grid: string;
  readonly menu: string;
  readonly streak: string;
}

export interface ThemeMotion {
  readonly exitMinMs: number;
  readonly exitMaxMs: number;
  /** Extra exit time per cell travelled, before clamping to the range. */
  readonly exitMsPerCell: number;
  readonly shakeMs: number;
  /** A chance breaking: halves split, twist apart and settle. */
  readonly chanceBreakMs: number;
  /** Pause between the last arrow leaving and the end-of-board sheet. */
  readonly settleMs: number;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly colors: ThemeColors;
  readonly tiers: Readonly<Record<Tier, string>>;
  /** Drawing palette names (from the drawing's legend) to colours. */
  readonly drawingPalette: Readonly<Record<string, string>>;
  readonly shadows: ThemeShadows;
  readonly board: BoardStyle;
  /** Which way the chance arrowheads point in the header. */
  readonly chanceDirection: 'right' | 'up';
  readonly fonts: { readonly title: string; readonly ui: string };
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
  properties['--shadow-raised'] = theme.shadows.raised;
  properties['--font-title'] = theme.fonts.title;
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

export interface ArrowColors {
  readonly body: string;
  readonly head: string;
}

/**
 * The colours of an arrow whose cells have palette entry `entry`: the theme's
 * colour for that name, the entry itself when it already is a CSS colour (a
 * drawing decoded from a PNG), both for body and head; or, on a plain board,
 * the theme's stroke and head.
 */
export function arrowColors(theme: Theme, entry: string | undefined): ArrowColors {
  const named = entry === undefined ? undefined : theme.drawingPalette[entry];
  if (named !== undefined) return { body: named, head: named };
  if (entry !== undefined && CSS_COLOR.test(entry)) return { body: entry, head: entry };
  return { body: theme.colors.stroke, head: theme.colors.head };
}
