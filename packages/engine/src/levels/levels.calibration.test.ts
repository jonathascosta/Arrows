import { describe, expect, it } from 'vitest';
import { generateLevel } from './levels.ts';
import { TIERS, TIER_ORDER, tierForLevel } from './tiers.ts';
import type { Tier } from './tiers.ts';

/**
 * The difficulty bands the product document promises, checked on real levels.
 * Runs with `pnpm test:calibration`.
 */
describe('level difficulty calibration', () => {
  const levels = Array.from({ length: 400 }, (_, i) => i + 1);
  const byTier = new Map<Tier, number[]>(TIER_ORDER.map((tier) => [tier, []]));
  const lengths = new Map<Tier, number[]>(TIER_ORDER.map((tier) => [tier, []]));
  const free = new Map<Tier, number[]>(TIER_ORDER.map((tier) => [tier, []]));
  const timings: number[] = [];

  it('every level from 1 to 400 lands inside its tier band', () => {
    let outside = 0;
    for (const level of levels) {
      const started = performance.now();
      const { tier, analysis } = generateLevel(level);
      timings.push(performance.now() - started);
      expect(tier).toBe(tierForLevel(level));
      byTier.get(tier)!.push(analysis.avgFreeRatio);
      lengths.get(tier)!.push(analysis.avgPathLength);
      free.get(tier)!.push(analysis.avgFree);
      const [low, high] = TIERS[tier].target.avgFreeRatio;
      if (analysis.avgFreeRatio < low || analysis.avgFreeRatio > high) outside++;
    }
    // The generator keeps the nearest candidate when none is in band; allow a few.
    expect(outside).toBeLessThanOrEqual(4);
  });

  it('medians get harder up the tiers', () => {
    const median = (tier: Tier): number => {
      const sorted = [...byTier.get(tier)!].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)]!;
    };
    expect(median('easy')).toBeGreaterThan(median('medium'));
    expect(median('medium')).toBeGreaterThan(median('hard'));
    expect(median('hard')).toBeGreaterThan(median('superHard'));
  });

  it('gives Super Hard long arrows and few free at a time, and Hard between it and Medium', () => {
    const mean = (values: Map<Tier, number[]>, tier: Tier): number => {
      const list = values.get(tier)!;
      return list.reduce((sum, value) => sum + value, 0) / list.length;
    };
    // T14 (docs/PLAN.md): Super Hard arrows of about eight cells, one to three free at a time.
    expect(mean(lengths, 'superHard')).toBeGreaterThanOrEqual(7);
    expect(mean(lengths, 'superHard')).toBeLessThanOrEqual(10);
    expect(mean(free, 'superHard')).toBeGreaterThanOrEqual(1);
    expect(mean(free, 'superHard')).toBeLessThanOrEqual(3);
    expect(mean(lengths, 'hard')).toBeGreaterThan(mean(lengths, 'medium'));
    expect(mean(lengths, 'hard')).toBeLessThan(mean(lengths, 'superHard'));
    expect(mean(free, 'hard')).toBeLessThan(mean(free, 'medium'));
    expect(mean(free, 'hard')).toBeGreaterThan(mean(free, 'superHard'));
  });

  it('generates any level in well under a second', () => {
    expect(Math.max(...timings)).toBeLessThan(1000);
  });
});
