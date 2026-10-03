import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDuration, spellOut, t, tn } from './strings.ts';

describe('t', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('title.level', { n: 12 })).toBe('Level 12');
    expect(t('hud.chances', { n: 2, total: 3 })).toBe('2 of 3 chances left');
    expect(t('title.level')).toBe('Level {n}');
  });
});

describe('tn', () => {
  it('picks the singular for one and the plural otherwise', () => {
    expect(tn('status.blocked', 1)).toBe('Blocked. 1 chance left.');
    expect(tn('status.blocked', 2)).toBe('Blocked. 2 chances left.');
    expect(tn('status.blocked', 0)).toBe('Blocked. 0 chances left.');
    expect(tn('board.label', 1)).toMatch(/^Board, 1 arrow left\./);
    expect(tn('board.label', 142)).toMatch(/^Board, 142 arrows left\./);
  });
});

describe('spellOut', () => {
  it('spells small counts and keeps digits from 11', () => {
    expect(spellOut(3)).toBe('three');
    expect(spellOut(0)).toBe('zero');
    expect(spellOut(10)).toBe('ten');
    expect(spellOut(11)).toBe('11');
    expect(t('lost.body', { total: spellOut(3) })).toBe(
      'Retry plays the same puzzle again, with three fresh chances and the timer reset.',
    );
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
