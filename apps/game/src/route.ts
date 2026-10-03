import { findDrawing, TIER_ORDER, weekdayOf } from '@arrows/engine';
import type { Tier } from '@arrows/engine';

/** Which puzzle a page shows. Every one of them is a seed: the URL is the puzzle. */
export type PuzzleRef =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'daily'; readonly dateKey: string }
  | { readonly kind: 'drawing'; readonly drawingId: string; readonly tier: Tier };

export const FIRST_LEVEL: PuzzleRef = { kind: 'level', level: 1 };

function isTier(value: string | null): value is Tier {
  return value !== null && (TIER_ORDER as readonly string[]).includes(value);
}

function isDateKey(value: string): boolean {
  try {
    weekdayOf(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads `?level=N`, `?daily=YYYY-MM-DD` or `?drawing=id&tier=hard`. Anything
 * missing or invalid opens level 1, so a bad link never shows an error page.
 */
export function parseRoute(search: string): PuzzleRef {
  const params = new URLSearchParams(search);
  const daily = params.get('daily');
  if (daily !== null && isDateKey(daily)) return { kind: 'daily', dateKey: daily };
  const drawing = params.get('drawing');
  if (drawing !== null && findDrawing(drawing) !== undefined) {
    const tier = params.get('tier');
    return { kind: 'drawing', drawingId: drawing, tier: isTier(tier) ? tier : 'medium' };
  }
  const level = Number(params.get('level'));
  if (Number.isSafeInteger(level) && level >= 1) return { kind: 'level', level };
  return FIRST_LEVEL;
}

export function routeSearch(ref: PuzzleRef): string {
  switch (ref.kind) {
    case 'level':
      return `?level=${ref.level}`;
    case 'daily':
      return `?daily=${ref.dateKey}`;
    case 'drawing':
      return `?drawing=${encodeURIComponent(ref.drawingId)}&tier=${ref.tier}`;
  }
}

/** Today's date key in the device's local time zone (docs/PRODUCT.md). */
export function localDateKey(date: Date = new Date()): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
