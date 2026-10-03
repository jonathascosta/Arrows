import { findDrawing, TIER_ORDER } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import type { MonthKey } from './daily/days.ts';
import { isDateKey, isMonthKey } from './daily/days.ts';

/** Which puzzle a page shows. Every one of them is a seed: the URL is the puzzle. */
export type PuzzleRef =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'daily'; readonly dateKey: string }
  | { readonly kind: 'drawing'; readonly drawingId: string; readonly tier: Tier };

/** What an address shows: the home screen, the daily calendar, or a puzzle. */
export type Route =
  | { readonly screen: 'home' }
  | { readonly screen: 'calendar'; readonly month: MonthKey | null }
  | { readonly screen: 'play'; readonly ref: PuzzleRef };

/** The home screen: the page with nothing else in its address. */
export const HOME_HREF = './';

function isTier(value: string | null): value is Tier {
  return value !== null && (TIER_ORDER as readonly string[]).includes(value);
}

/**
 * Reads `?level=N`, `?daily=YYYY-MM-DD`, `?drawing=id&tier=hard` or
 * `?calendar[=YYYY-MM]`. Nothing, or anything invalid, is the home screen, so
 * a bad link never shows an error page. Whether a day can be opened yet is
 * the app's to decide.
 */
export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const daily = params.get('daily');
  if (daily !== null && isDateKey(daily)) {
    return { screen: 'play', ref: { kind: 'daily', dateKey: daily } };
  }
  const drawing = params.get('drawing');
  if (drawing !== null && findDrawing(drawing) !== undefined) {
    const tier = params.get('tier');
    return {
      screen: 'play',
      ref: { kind: 'drawing', drawingId: drawing, tier: isTier(tier) ? tier : 'medium' },
    };
  }
  const level = Number(params.get('level'));
  if (params.has('level') && Number.isSafeInteger(level) && level >= 1) {
    return { screen: 'play', ref: { kind: 'level', level } };
  }
  const calendar = params.get('calendar');
  if (calendar !== null) {
    return { screen: 'calendar', month: isMonthKey(calendar) ? calendar : null };
  }
  return { screen: 'home' };
}

/** The search part of an address, `?…`, or empty for the home screen. */
export function routeSearch(route: Route): string {
  switch (route.screen) {
    case 'home':
      return '';
    case 'calendar':
      return route.month === null ? '?calendar' : `?calendar=${route.month}`;
    case 'play':
      return puzzleSearch(route.ref);
  }
}

export function puzzleSearch(ref: PuzzleRef): string {
  switch (ref.kind) {
    case 'level':
      return `?level=${ref.level}`;
    case 'daily':
      return `?daily=${ref.dateKey}`;
    case 'drawing':
      return `?drawing=${encodeURIComponent(ref.drawingId)}&tier=${ref.tier}`;
  }
}

/** The address of a route, relative to the app. */
export function routeHref(route: Route): string {
  return `./${routeSearch(route)}`;
}

export function puzzleHref(ref: PuzzleRef): string {
  return routeHref({ screen: 'play', ref });
}

export function calendarHref(month: MonthKey | null = null): string {
  return routeHref({ screen: 'calendar', month });
}
