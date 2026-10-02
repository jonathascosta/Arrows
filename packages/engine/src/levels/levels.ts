import { rectangleMask } from '../board/mask.ts';
import type { Mask, RayMode } from '../board/types.ts';
import { generateInBand } from '../generator/generate.ts';
import type { GeneratedPuzzle } from '../generator/generate.ts';
import { TIERS, boardSizeForLevel, tierForLevel } from './tiers.ts';
import type { Tier } from './tiers.ts';

export interface LevelPuzzle extends GeneratedPuzzle {
  readonly level: number;
  readonly tier: Tier;
}

export interface DailyPuzzle extends GeneratedPuzzle {
  readonly dateKey: string;
  readonly tier: Tier;
}

export interface BoardPuzzle extends GeneratedPuzzle {
  readonly id: string;
  readonly tier: Tier;
}

/** Level N, the same on every phone: seed `level:N`. */
export function generateLevel(level: number): LevelPuzzle {
  const tier = tierForLevel(level);
  const [width, height] = boardSizeForLevel(level, tier);
  return { level, tier, ...generateForTier(rectangleMask(width, height), tier, `level:${level}`) };
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Sunday is 0. Throws on anything but a real `YYYY-MM-DD`. */
export function weekdayOf(dateKey: string): number {
  const match = DATE_KEY.exec(dateKey);
  if (!match) throw new RangeError(`Date key must be YYYY-MM-DD, got "${dateKey}"`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a calendar date: "${dateKey}"`);
  }
  return date.getUTCDay();
}

/** The daily challenge: a larger medium board on weekdays, hard on weekends. Seed `daily:YYYY-MM-DD`. */
export function generateDaily(dateKey: string): DailyPuzzle {
  const weekday = weekdayOf(dateKey);
  const weekend = weekday === 0 || weekday === 6;
  const tier: Tier = weekend ? 'hard' : 'medium';
  const mask = weekend ? rectangleMask(18, 27) : rectangleMask(16, 24);
  return { dateKey, tier, ...generateForTier(mask, tier, `daily:${dateKey}`) };
}

export interface BoardOptions {
  /** Part of the seed: an event id, a championship round. */
  readonly id: string;
  readonly mask: Mask;
  readonly tier: Tier;
  readonly rayMode?: RayMode;
}

/** A board on any mask, for events and championships. Seed `board:<id>`. */
export function generateBoard(options: BoardOptions): BoardPuzzle {
  return {
    id: options.id,
    tier: options.tier,
    ...generateForTier(options.mask, options.tier, `board:${options.id}`, options.rayMode),
  };
}

export function generateForTier(
  mask: Mask,
  tier: Tier,
  seed: string,
  rayMode?: RayMode,
): GeneratedPuzzle {
  const params = TIERS[tier];
  return generateInBand({
    mask,
    seed,
    partition: params.partition,
    peel: params.peel,
    candidates: params.candidates,
    target: params.target,
    prefer: params.prefer,
    ...(rayMode ? { rayMode } : {}),
  });
}
