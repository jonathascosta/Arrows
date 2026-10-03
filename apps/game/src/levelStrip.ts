import { tierForLevel } from '@arrows/engine';
import type { Tier } from '@arrows/engine';

export interface StripItem {
  readonly level: number;
  readonly tier: Tier;
  /** Finished, the one to play now, or still ahead. */
  readonly state: 'done' | 'current' | 'next';
}

/**
 * The levels around the current one for the home screen's strip (docs/DESIGN.md,
 * Home): three before it when there are three, the current one, and the rest
 * ahead, `size` in all.
 */
export function levelStrip(current: number, size = 7): StripItem[] {
  const before = Math.floor((size - 1) / 2);
  const first = Math.max(1, current - before);
  return Array.from({ length: size }, (_, i) => {
    const level = first + i;
    return {
      level,
      tier: tierForLevel(level),
      state: level < current ? 'done' : level === current ? 'current' : 'next',
    };
  });
}
