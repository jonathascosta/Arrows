import { findDrawing, TIER_ORDER } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import type { MonthKey } from './daily/days.ts';
import { isDateKey, isMonthKey } from './daily/days.ts';
import { findEvent } from './events/catalog.ts';

/** Which puzzle a page shows. Every one of them is a seed: the URL is the puzzle. */
export type PuzzleRef =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'daily'; readonly dateKey: string }
  | { readonly kind: 'drawing'; readonly drawingId: string; readonly tier: Tier }
  /** A board of an event, numbered from 1. */
  | { readonly kind: 'event'; readonly eventId: string; readonly board: number };

/** What an address shows: the home screen, the daily calendar, or a puzzle. */
export type Route =
  | { readonly screen: 'home' }
  | { readonly screen: 'calendar'; readonly month: MonthKey | null }
  | { readonly screen: 'league' }
  | { readonly screen: 'credits' }
  | { readonly screen: 'play'; readonly ref: PuzzleRef };

/** The home screen: the page with nothing else in its address. */
export const HOME_HREF = './';

function isTier(value: string | null): value is Tier {
  return value !== null && (TIER_ORDER as readonly string[]).includes(value);
}

/**
 * Reads `?level=N`, `?daily=YYYY-MM-DD`, `?event=id&board=N`,
 * `?drawing=id&tier=hard`, `?calendar[=YYYY-MM]`, `?league` or `?credits`. Nothing, or anything invalid, is the home screen, so
 * a bad link never shows an error page. Whether a day can be opened yet is
 * the app's to decide.
 */
export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const daily = params.get('daily');
  if (daily !== null && isDateKey(daily)) {
    return { screen: 'play', ref: { kind: 'daily', dateKey: daily } };
  }
  const eventId = params.get('event');
  const event = eventId === null ? undefined : findEvent(eventId);
  const board = Number(params.get('board') ?? '1');
  if (
    event !== undefined &&
    Number.isSafeInteger(board) &&
    board >= 1 &&
    board <= event.boards.length
  ) {
    return { screen: 'play', ref: { kind: 'event', eventId: event.id, board } };
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
  if (params.has('league')) return { screen: 'league' };
  if (params.has('credits')) return { screen: 'credits' };
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
    case 'league':
      return '?league';
    case 'credits':
      return '?credits';
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
    case 'event':
      return `?event=${encodeURIComponent(ref.eventId)}&board=${ref.board}`;
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

export const LEAGUE_HREF = './?league';
export const CREDITS_HREF = './?credits';

/**
 * The privacy policy, a page of its own next to the game (docs/STORE.md); from
 * the game, so the page offers the way back to it.
 */
export const PRIVACY_HREF = 'privacy.html?from=game';

/**
 * The same board, the same key: `level:12`, `daily:2026-10-03`,
 * `event:autumn-2026:2`, `drawing:butterfly:hard`.
 */
export function puzzleKey(ref: PuzzleRef): string {
  switch (ref.kind) {
    case 'level':
      return `level:${ref.level}`;
    case 'daily':
      return `daily:${ref.dateKey}`;
    case 'drawing':
      return `drawing:${ref.drawingId}:${ref.tier}`;
    case 'event':
      return `event:${ref.eventId}:${ref.board}`;
  }
}
