import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../theme/default.ts';
import { CalendarScreen } from './calendar.ts';

const days = (month: string, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${month}-${String(from + i).padStart(2, '0')}`);

function mount(
  month: string,
  today: string,
  finished: Iterable<string> = [],
): { root: HTMLElement; screen: CalendarScreen; moves: string[] } {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const moves: string[] = [];
  const screen = new CalendarScreen(root, {
    theme: DEFAULT_THEME,
    today,
    month,
    finished: new Set(finished),
    homeHref: './',
    onMonth: (next) => moves.push(next),
  });
  return { root, screen, moves };
}

const day = (root: HTMLElement, dateKey: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-day="${dateKey}"]`)!;

describe('CalendarScreen', () => {
  it('heads the month with its stars and weeks from Monday', () => {
    const { root } = mount('2026-10', '2026-10-14', ['2026-10-02', '2026-10-09']);
    expect(root.querySelector('h1')?.textContent).toBe('Daily challenge');
    expect(document.title).toBe('Daily challenge · Arrows');
    expect(root.querySelector('.month-title h2')?.textContent).toBe('October 2026');
    expect(root.querySelector('.month-stars')?.textContent).toBe('2 of 31 stars');
    expect([...root.querySelectorAll('.week-heads span')].map((s) => s.textContent).join('')).toBe(
      'MTWTFSS',
    );
    // 1 October 2026 is a Thursday: three blanks before it.
    expect(root.querySelectorAll('.month-days .blank')).toHaveLength(3);
    expect(root.querySelectorAll('.month-days [data-day]')).toHaveLength(31);
    expect(root.querySelector('.back')?.getAttribute('href')).toBe('./');
  });

  it('links the days that can be opened, stars the won ones and locks the rest', () => {
    const { root } = mount('2026-10', '2026-10-14', ['2026-10-02', '2026-10-14', '2026-10-20']);
    const won = day(root, '2026-10-02');
    expect(won.tagName).toBe('A');
    expect(won.getAttribute('href')).toBe('./?daily=2026-10-02');
    expect(won.dataset.state).toBe('done');
    expect(won.querySelector('.star')).not.toBeNull();
    expect(won.querySelector('.sr-only')?.textContent).toBe('Friday 2 October, star earned');

    const open = day(root, '2026-10-03');
    expect(open.tagName).toBe('A');
    expect(open.dataset.state).toBe('open');
    expect(open.querySelector('.star')).toBeNull();
    expect(open.querySelector('.sr-only')?.textContent).toBe('Saturday 3 October');

    const today = day(root, '2026-10-14');
    expect(today.dataset.today).toBe('true');
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.querySelector('.sr-only')?.textContent).toBe(
      'Wednesday 14 October, today, star earned',
    );

    // Days ahead are not links, even with a stored star.
    for (const dateKey of ['2026-10-15', '2026-10-20', '2026-10-31']) {
      const locked = day(root, dateKey);
      expect(locked.tagName, dateKey).toBe('SPAN');
      expect(locked.hasAttribute('href')).toBe(false);
      expect(locked.dataset.state).toBe('locked');
      expect(locked.querySelector('.star')).toBeNull();
    }
    expect(day(root, '2026-10-15').querySelector('.sr-only')?.textContent).toBe(
      'Thursday 15 October, locked',
    );
  });

  it('moves between months, and stops at the first daily and at today', () => {
    const { root, moves } = mount('2026-10', '2026-10-14');
    const next = (): HTMLButtonElement => root.querySelector('.month-head .next')!;
    const previous = (): HTMLButtonElement => root.querySelector('.month-head .previous')!;
    expect(next().disabled).toBe(true);
    expect(previous().getAttribute('aria-label')).toBe('Previous month');
    previous().click();
    expect(moves).toEqual(['2026-09']);
    expect(root.querySelector('.month-title h2')?.textContent).toBe('September 2026');
    expect(next().disabled).toBe(false);
    // Every day of September is in the past: all open.
    expect(root.querySelectorAll('.month-days a[data-day]')).toHaveLength(30);

    const first = mount('2026-01', '2026-10-14');
    expect(first.root.querySelector<HTMLButtonElement>('.month-head .previous')!.disabled).toBe(
      true,
    );
  });

  it('shows the trophies of earlier months, or how to earn one', () => {
    const finished = [...days('2026-09', 1, 30), ...days('2026-08', 1, 29), '2026-10-01'];
    const { root } = mount('2026-10', '2026-10-14', finished);
    const cards = [...root.querySelectorAll('.trophy-row li')];
    expect(cards.map((card) => card.className)).toEqual(['trophy complete', 'trophy missed']);
    expect(cards[0]?.getAttribute('aria-label')).toBe('September 2026: trophy, every day won');
    expect(cards[0]?.textContent).toBe('Sep');
    expect(cards[1]?.getAttribute('aria-label')).toBe('August 2026: 29 of 31 days won');
    expect(cards[1]?.textContent).toBe('29 of 31Aug');

    const empty = mount('2026-10', '2026-10-14', ['2026-10-01']);
    expect(empty.root.querySelector('.trophy-row')).toBeNull();
    expect(empty.root.querySelector('.trophies .card-note')?.textContent).toBe(
      'Win every day of a month to earn its trophy.',
    );
  });

  it('plays today’s board and says what it is', () => {
    const weekday = mount('2026-10', '2026-10-14');
    const play = weekday.root.querySelector('.play-today')!;
    expect(play.textContent).toBe('Play today');
    expect(play.getAttribute('href')).toBe('./?daily=2026-10-14');
    expect(weekday.root.querySelector('#today-board')?.textContent).toBe(
      'Weekday board · Medium · 16 × 24',
    );
    const weekend = mount('2026-10', '2026-10-17');
    expect(weekend.root.querySelector('#today-board')?.textContent).toBe(
      'Weekend board · Hard · 18 × 27',
    );
  });

  it('drops its listeners on destroy', () => {
    const { root, screen, moves } = mount('2026-10', '2026-10-14');
    const previous = root.querySelector<HTMLButtonElement>('.month-head .previous')!;
    screen.destroy();
    expect(root.childElementCount).toBe(0);
    previous.click();
    expect(moves).toEqual([]);
  });
});
