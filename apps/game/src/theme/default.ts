import type { Theme } from './theme.ts';

const icon = (body: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/**
 * Paper: the direction delivered by Claude Design (docs/DESIGN.md). Warm paper
 * and ink, Instrument Serif for titles and Geist for the interface.
 */
export const DEFAULT_THEME: Theme = {
  id: 'paper',
  name: 'Paper',
  colors: {
    background: '#f4f0e8',
    surface: '#e9e3d6',
    surfaceRaised: '#fcfaf6',
    text: '#2a2723',
    textMuted: '#6e675c',
    title: '#1e1b17',
    divider: '#ddd5c6',
    stroke: '#2b2925',
    head: '#2b2925',
    hint: '#c9741f',
    blocked: '#b93d2a',
    grid: '#e8e1d3',
    chance: '#2b2925',
    chanceLost: '#d6cebf',
    primary: '#2b2925',
    onPrimary: '#fcfaf6',
    focus: '#c9741f',
  },
  tiers: {
    // The design's #3F7D4E reaches 4.34:1 on the background; this shade reaches 4.5:1
    // for the small tier label (docs/DESIGN.md, Tokens).
    easy: '#3d784b',
    medium: '#3c6fa0',
    hard: '#7a4fa6',
    superHard: '#a83e34',
  },
  // drawing1 to drawing4 of the design, by the names the drawings use. The design has
  // no red, blue, purple or black yet (DESIGN.md, open points): the tier colours and the
  // stroke stand in.
  drawingPalette: {
    orange: '#d9822b',
    yellow: '#c9a227',
    brown: '#7a4e2d',
    green: '#4f8a5b',
    red: '#a83e34',
    blue: '#3c6fa0',
    purple: '#7a4fa6',
    black: '#2b2925',
  },
  shadows: {
    raised: '0 1px 2px rgba(43, 41, 37, 0.06), 0 6px 18px rgba(43, 41, 37, 0.08)',
  },
  board: {
    strokeWidth: 0.12,
    tailReach: 0.38,
    headTip: 0.42,
    headDepth: 0.42,
    headHalfWidth: 0.17,
    bodyEnd: 0.14,
    gridWidth: 0.03,
    margin: 0.6,
  },
  chanceDirection: 'right',
  fonts: {
    title: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
    ui: '"Geist Variable", Geist, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  icons: {
    back: icon('<path d="M15 5l-7 7 7 7"/>'),
    hint: icon(
      '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    ),
    grid: icon(
      '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
    ),
  },
  motion: {
    exitMinMs: 250,
    exitMaxMs: 400,
    exitMsPerCell: 9,
    shakeMs: 280,
    chanceBreakMs: 300,
    settleMs: 150,
  },
};
