import type { Tier } from '../levels/tiers.ts';

export interface BoardResult {
  readonly tier: Tier;
  readonly cellCount: number;
  readonly timeSeconds: number;
  readonly mistakes: number;
  /** Event and championship boards score more. */
  readonly event?: boolean;
}

export const TIER_MULTIPLIER: Readonly<Record<Tier, number>> = {
  easy: 0.5,
  medium: 1,
  hard: 1.5,
  superHard: 2,
};

/** Par: one second per cell. Faster than par earns up to +40%, slower loses up to 40%. */
export function parSeconds(cellCount: number): number {
  return cellCount;
}

/**
 * Points for one finished board. A medium board of 120 cells at par with no
 * mistakes is worth 120 points; the league calibration counts in these units.
 */
export function scoreBoard(result: BoardResult): number {
  const base = result.cellCount * TIER_MULTIPLIER[result.tier];
  const par = parSeconds(result.cellCount);
  const time = Math.max(1, result.timeSeconds);
  const timeFactor = Math.min(1.4, Math.max(0.6, 0.6 + 0.4 * (par / time)));
  const mistakeFactor = Math.max(0.55, 1 - 0.15 * result.mistakes);
  const eventFactor = result.event ? 1.25 : 1;
  return Math.round(base * timeFactor * mistakeFactor * eventFactor);
}
