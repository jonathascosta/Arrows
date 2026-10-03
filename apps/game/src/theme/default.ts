import type { Theme } from './theme.ts';

const icon = (body: string, viewBox = '0 0 24 24'): string =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/**
 * The placeholder theme: the palette of the reference screenshots (pale green
 * background, dark green strokes, blue drops) until the designed theme from
 * Claude Design arrives (docs/PLAN.md, T9).
 */
export const DEFAULT_THEME: Theme = {
  id: 'meadow',
  name: 'Meadow',
  colors: {
    background: '#dcefe2',
    surface: '#c9e1d1',
    surfaceRaised: '#f2faf4',
    shadow: 'rgba(31, 61, 43, 0.18)',
    text: '#2f4a3a',
    textMuted: '#5d7667',
    title: '#3a86a0',
    divider: '#c5dccc',
    stroke: '#2f4a3a',
    hint: '#e08a2c',
    blocked: '#c8424f',
    grid: 'rgba(47, 74, 58, 0.16)',
    drop: '#56a5c0',
    dropEmpty: '#b9cfc1',
    scrim: 'rgba(28, 48, 37, 0.45)',
    button: '#3a86a0',
    buttonText: '#ffffff',
    focus: '#e08a2c',
  },
  tiers: {
    easy: '#3f9a63',
    medium: '#3a86a0',
    hard: '#6c4fc2',
    superHard: '#a8455a',
  },
  drawingPalette: {
    red: '#c8475a',
    orange: '#e08a3c',
    yellow: '#c99a1e',
    brown: '#7a5233',
    green: '#2f6b3f',
    blue: '#3a86a0',
    purple: '#6c4fc2',
    black: '#2b2b2b',
  },
  board: {
    strokeWidth: 0.12,
    tailReach: 0.38,
    headTip: 0.38,
    headDepth: 0.3,
    headHalfWidth: 0.19,
    bodyEnd: 0.12,
    gridWidth: 0.03,
    margin: 0.6,
  },
  fonts: {
    ui: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  icons: {
    back: icon('<path d="M20 12H5"/><path d="M11 5l-7 7 7 7"/>'),
    drop: `<svg viewBox="0 0 24 30" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 1.5C9.4 6.2 3 13.4 3 19.2 3 24.3 7 28.5 12 28.5s9-4.2 9-9.3C21 13.4 14.6 6.2 12 1.5z"/></svg>`,
    clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l-2.5 2.5"/>'),
    hint: icon(
      '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    ),
    grid: icon(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    ),
  },
  motion: {
    exitMinMs: 250,
    exitMaxMs: 400,
    exitMsPerCell: 9,
    shakeMs: 280,
    settleMs: 150,
  },
};
