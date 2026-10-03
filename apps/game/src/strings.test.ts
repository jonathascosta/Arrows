import { afterEach, describe, expect, it } from 'vitest';
import {
  capitalize,
  drawingTitle,
  formatDateKey,
  formatDayInText,
  formatDayLong,
  formatDayShort,
  formatCountdown,
  formatDuration,
  formatMonth,
  formatMonthShort,
  formatMonthTitle,
  formatNumber,
  getLocale,
  leagueLabel,
  localeFor,
  ordinal,
  setLocale,
  spellOut,
  STRING_KEYS,
  t,
  tn,
  weekdayNames,
} from './strings.ts';

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
    expect(tn('status.blocked', 0)).toBe('Blocked. No chances left.');
    // Keys without a zero form take the plural.
    expect(tn('league.points', 0)).toBe('0 points');
    expect(tn('league.points', 12_345)).toBe('12,345 points');
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

describe('formatDayShort', () => {
  it('names a day the way the home screen shows it, in any time zone', () => {
    expect(formatDayShort('2026-10-03')).toBe('Sat 3 Oct');
    expect(formatDayShort('2027-01-01')).toBe('Fri 1 Jan');
  });
});

describe('day and month names', () => {
  it('names days and months the same way in every engine', () => {
    expect(formatDayShort('2026-09-05')).toBe('Sat 5 Sep');
    expect(formatDayLong('2026-10-03')).toBe('Saturday 3 October');
    expect(formatDayLong('2026-10-05')).toBe('Monday 5 October');
    expect(formatDateKey('2026-09-30')).toBe('Sep 30, 2026');
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
    expect(formatMonthShort('2026-09', 2026)).toBe('Sep');
    expect(formatMonthShort('2025-12', 2026)).toBe('Dec 2025');
  });

  it('heads the calendar’s weeks from Monday', () => {
    expect(weekdayNames().map((name) => name.narrow)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayNames()[0]!.long).toBe('Monday');
    expect(weekdayNames()[6]!.long).toBe('Sunday');
  });
});

describe('ordinal', () => {
  it('names ranks in English', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 30, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '10th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '30th',
      '101st',
      '111th',
    ]);
  });
});

describe('formatCountdown', () => {
  it('shows hours and minutes, rounding minutes up', () => {
    // A no-break space keeps the time on one line.
    expect(formatCountdown((7 * 60 + 47) * 60_000 + 30_000)).toBe('7h\u00a048m');
    expect(formatCountdown(3_600_000)).toBe('1h\u00a00m');
    expect(formatCountdown(12 * 60_000)).toBe('12m');
    expect(formatCountdown(5_000)).toBe('1m');
    expect(formatCountdown(0)).toBe('1m');
  });
});

describe('Portuguese', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('follows the first of the device’s languages that the game speaks', () => {
    expect(localeFor(['pt-BR'])).toBe('pt');
    expect(localeFor(['pt-PT', 'en'])).toBe('pt');
    expect(localeFor(['fr-FR', 'pt'])).toBe('pt');
    expect(localeFor(['de', 'en-GB', 'pt'])).toBe('en');
    expect(localeFor(['ja'])).toBe('en');
    expect(localeFor([])).toBe('en');
  });

  it('has every string, with the English placeholders and nothing left in English', () => {
    // Which placeholders, not how often: a translation may name the league once.
    const placeholders = (text: string): string[] =>
      [...new Set([...text.matchAll(/\{\w+\}/g)].map(String))].sort();
    const english: Record<string, string> = {};
    const portuguese: Record<string, string> = {};
    for (const key of STRING_KEYS) {
      setLocale('en');
      english[key] = t(key);
      setLocale('pt');
      portuguese[key] = t(key);
    }
    for (const key of STRING_KEYS) {
      expect(placeholders(portuguese[key]!), key).toEqual(placeholders(english[key]!));
    }
    // Words that only English uses: a missed translation would show one.
    // ("chances" is Portuguese too; placeholders are names, not words.)
    const untranslated = STRING_KEYS.filter((key) =>
      /\b(the|and|of|board|level|league|day|win|won|points?)\b/i.test(
        portuguese[key]!.replace(/\{\w+\}/g, ''),
      ),
    );
    expect(untranslated).toEqual([]);
  });

  it('counts, names days and months, and ranks the Brazilian way', () => {
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(tn('league.points', 1)).toBe('1 ponto');
    expect(tn('league.points', 38)).toBe('38 pontos');
    expect(tn('status.blocked', 1)).toBe('Bloqueada. Resta 1 chance.');
    expect(tn('status.blocked', 0)).toBe('Bloqueada. Nenhuma chance restante.');
    expect(tn('league.points', 50_000)).toBe('50.000 pontos');
    expect(formatNumber(-1234567)).toBe('-1.234.567');
    expect(formatDayInText('2026-10-02')).toBe('2 de outubro');
    expect(t('lost.body', { total: spellOut(3) })).toBe(
      'Tentar de novo recomeça o mesmo quebra-cabeça, com três chances novas e o tempo zerado.',
    );
    expect(spellOut(1)).toBe('uma');
    expect(spellOut(2)).toBe('duas');
    expect(formatDayShort('2026-10-03')).toBe('sáb 3 out');
    expect(capitalize(formatDayShort('2026-10-03'))).toBe('Sáb 3 out');
    expect(formatDayLong('2026-10-05')).toBe('segunda-feira, 5 de outubro');
    expect(formatDateKey('2026-10-02')).toBe('2 out 2026');
    expect(formatMonth('2026-10')).toBe('outubro de 2026');
    expect(formatMonthTitle('2026-10')).toBe('Outubro de 2026');
    expect(formatMonthShort('2026-09', 2026)).toBe('set');
    expect(formatMonthShort('2025-12', 2026)).toBe('dez 2025');
    expect(weekdayNames().map((name) => name.narrow)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    expect(weekdayNames()[0]!.long).toBe('segunda-feira');
    expect([1, 2, 8, 21].map(ordinal)).toEqual(['1º', '2º', '8º', '21º']);
    expect(leagueLabel('Gold')).toBe('Ouro');
    expect(drawingTitle('maple-leaf', 'Maple leaf')).toBe('Folha de bordo');
    // A drawing the strings do not know keeps the art's own name.
    expect(drawingTitle('surfboard', 'Surfboard')).toBe('Surfboard');
    expect(
      t('won.league', { points: tn('league.points', 38), league: 'Ouro', rank: ordinal(8) }),
    ).toBe('+38 pontos na liga Ouro · agora em 8º.');
    expect(t('won.star', { day: formatDayInText('2026-10-03') })).toBe(
      'Uma estrela para o dia 3 de outubro.',
    );
  });

  it('keeps English the same as before', () => {
    expect(getLocale()).toBe('en');
    expect(leagueLabel('Gold')).toBe('Gold');
    expect(drawingTitle('maple-leaf', 'Maple leaf')).toBe('Maple leaf');
    expect(formatMonthTitle('2026-10')).toBe('October 2026');
    expect(capitalize(formatDayShort('2026-10-03'))).toBe('Sat 3 Oct');
    expect(formatDayInText('2026-10-03')).toBe('Sat 3 Oct');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(999)).toBe('999');
  });
});
