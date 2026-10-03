import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDuration, t } from './strings.ts';

describe('t', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('title.level', { n: 12 })).toBe('Level 12');
    expect(t('hud.drops', { n: 2, total: 3 })).toBe('2 of 3 drops left');
    expect(t('title.level')).toBe('Level {n}');
  });
});

describe('formatDuration', () => {
  it('shows mm:ss, and hours when needed', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration(61_999)).toBe('01:01');
    expect(formatDuration(3_600_000 + 5_000)).toBe('1:00:05');
  });
});

describe('formatDateKey', () => {
  it('formats a day key like the reference game', () => {
    expect(formatDateKey('2026-10-02')).toBe('Oct 2, 2026');
  });
});
