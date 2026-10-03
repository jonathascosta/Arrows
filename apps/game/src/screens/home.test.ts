import { describe, expect, it } from 'vitest';
import { SimulatedLeagueProvider } from '../league/simulated.ts';
import { INITIAL_PROGRESS } from '../persistence/progress.ts';
import { MemoryStore } from '../persistence/store.ts';
import { loadPuzzle } from '../puzzles.ts';
import type { Progress } from '../persistence/progress.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { AUTUMN_2026 } from '../events/catalog.ts';
import { HomeScreen } from './home.ts';
import type { HomeEvent } from './home.ts';

/** The Autumn event on 3 October with boards 1 and 2 won. */
const AUTUMN: HomeEvent = {
  event: AUTUMN_2026,
  state: 'running',
  progress: { won: [1, 2], total: 6, next: 3, complete: false },
  daysLeft: 59,
};

function mount(
  progress: Partial<Progress> = {},
  event: HomeEvent | null = AUTUMN,
): { root: HTMLElement; screen: HomeScreen } {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const screen = new HomeScreen(root, {
    theme: DEFAULT_THEME,
    progress: { ...INITIAL_PROGRESS, ...progress },
    event,
    finishedDays: new Set(['2026-10-01', '2026-10-02', '2026-09-30']),
    league: new SimulatedLeagueProvider(new MemoryStore(), 'You').view(
      new Date(2026, 9, 3, 16, 12),
    ),
    today: '2026-10-03',
    pickerHref: 'dev.html',
    reducedMotion: () => true,
  });
  return { root, screen };
}

describe('HomeScreen', () => {
  it('shows the wordmark, the streak and the puzzle picker', () => {
    const { root } = mount({ streak: 6 });
    expect(root.querySelector('h1')?.textContent).toBe('Arrows');
    expect(document.title).toBe('Arrows');
    // Screen readers read the hidden text; the short visible one is hidden from them.
    const streak = root.querySelector('.streak')!;
    expect(streak.tagName).toBe('P');
    expect(streak.querySelector('.sr-only')?.textContent).toBe('Win streak: 6');
    expect(streak.querySelector(':scope > [aria-hidden="true"]:not(.icon)')?.textContent).toBe(
      'Streak 6',
    );
    expect(streak.hasAttribute('aria-label')).toBe(false);
    const menu = root.querySelector('a.menu')!;
    expect(menu.getAttribute('href')).toBe('dev.html');
    expect(menu.getAttribute('aria-label')).toBe('Puzzle picker');
  });

  it('shows the current level, its tier and the strip around it, and plays it', () => {
    const { root } = mount({ currentLevel: 42 });
    const card = root.querySelector('.levels-card')!;
    expect(card.querySelector('h2')?.textContent).toBe('Level 42');
    expect(card.querySelector('.tier-badge')?.textContent).toBe('Medium');
    expect(card.querySelector('.tier-badge')?.getAttribute('data-tier')).toBe('medium');
    const items = [...card.querySelectorAll('.strip-item')];
    expect(items.map((item) => item.textContent)).toEqual([
      '39',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
    ]);
    expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
      'done',
      'done',
      'done',
      'current',
      'next',
      'next',
      'next',
    ]);
    expect(items[3]?.getAttribute('aria-label')).toBe('Level 42, next to play');
    expect(items[0]?.getAttribute('aria-label')).toBe('Level 39, done');
    expect(items[6]?.getAttribute('aria-label')).toBe('Level 45, ahead');
    const play = card.querySelector('a.play-button')!;
    expect(play.textContent).toBe('Play');
    expect(play.getAttribute('href')).toBe('./?level=42');
  });

  it('starts a new player at level 1 with no streak', () => {
    const { root } = mount();
    expect(root.querySelector('.levels-card h2')?.textContent).toBe('Level 1');
    expect(root.querySelector('.levels-card .tier-badge')?.textContent).toBe('Easy');
    expect(root.querySelector('.streak .sr-only')?.textContent).toBe('Win streak: 0');
    expect(root.querySelector('.play-button')?.getAttribute('href')).toBe('./?level=1');
  });

  it('opens the calendar and the league', () => {
    const { root } = mount();
    // The Daily card opens the calendar, with this month's stars.
    const daily = root.querySelector('a.daily')!;
    expect(daily.getAttribute('href')).toBe('./?calendar');
    expect(daily.textContent).toContain('Sat 3 Oct');
    expect(daily.querySelector('.daily-stars .sr-only')?.textContent).toBe(
      '2 of 31 stars this month',
    );
    expect(daily.querySelector('.daily-stars > [aria-hidden="true"]:not(.icon)')?.textContent).toBe(
      '2 of 31',
    );
    // Before a board is won today: the league's name and how to join.
    const league = root.querySelector('a.league')!;
    expect(league.getAttribute('href')).toBe('./?league');
    expect(league.querySelector('.card-title')?.textContent).toBe('Bronze');
    expect(league.querySelector('.card-note')?.textContent).toBe('Win a board to join today');
  });

  it('opens the event’s next board, with a segment per board and the days left', () => {
    const { root } = mount();
    const card = root.querySelector('a.event-card')!;
    expect(card.getAttribute('href')).toBe('./?event=autumn-2026&board=3');
    expect(card.querySelector('.card-label')?.textContent).toBe('Autumn event');
    // Board 3 is the maple leaf at Hard.
    expect(card.querySelector('.card-title')?.textContent).toBe('Maple Leaf');
    const segments = [...card.querySelectorAll('.event-progress span')];
    expect(segments).toHaveLength(6);
    expect(segments.map((segment) => segment.hasAttribute('data-done'))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(card.querySelector('.event-progress')?.getAttribute('aria-hidden')).toBe('true');
    expect(card.querySelector('.card-note')?.textContent).toBe('2 of 6 boards · 59 days left');
    // The thumbnail is that board itself, drawn small.
    const board = loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 3 });
    expect(card.querySelectorAll('.event-thumb [data-arrow]')).toHaveLength(
      board.puzzle.arrows.length,
    );
    expect(card.querySelector('.event-thumb')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says the last day, the badge, the end, or shows no event at all', () => {
    const lastDay = mount({}, { ...AUTUMN, daysLeft: 1 });
    expect(lastDay.root.querySelector('.event-card .card-note')?.textContent).toBe(
      '2 of 6 boards · Last day',
    );

    const complete = { won: [1, 2, 3, 4, 5, 6], total: 6, next: null, complete: true };
    const done = mount({}, { ...AUTUMN, progress: complete });
    // Nothing left to open: not a link, and the badge in place of the drawing.
    expect(done.root.querySelector('a.event-card')).toBeNull();
    const card = done.root.querySelector('.event-card')!;
    expect(card.querySelector('.badge-earned')?.textContent).toBe('Badge earned');
    expect(card.querySelectorAll('.event-progress [data-done]')).toHaveLength(6);

    const ended = mount({}, { ...AUTUMN, state: 'ended', daysLeft: 0 });
    expect(ended.root.querySelector('a.event-card')).toBeNull();
    expect(ended.root.querySelector('.event-card')?.getAttribute('data-state')).toBe('ended');
    expect(ended.root.querySelector('.event-card .card-note')?.textContent).toBe(
      '2 of 6 boards · Ended Mon 30 Nov',
    );

    expect(mount({}, null).root.querySelector('.event-card')).toBeNull();
  });

  it('leaves the page on destroy', () => {
    const { root, screen } = mount();
    screen.destroy();
    expect(root.childElementCount).toBe(0);
  });

  it('shows the rank and the countdown once a board is won today', () => {
    const provider = new SimulatedLeagueProvider(new MemoryStore(), 'You');
    const now = new Date(2026, 9, 3, 16, 12);
    provider.record(
      {
        key: 'level:900',
        tier: 'superHard',
        cellCount: 2000,
        timeSeconds: 1,
        chancesLost: 0,
        event: false,
      },
      now,
    );
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    new HomeScreen(root, {
      theme: DEFAULT_THEME,
      progress: INITIAL_PROGRESS,
      event: null,
      finishedDays: new Set(),
      league: provider.view(now),
      today: '2026-10-03',
      pickerHref: 'dev.html',
      reducedMotion: () => true,
    });
    expect(root.querySelector('a.league .card-title')?.textContent).toBe('Bronze · 1st');
    expect(root.querySelector('a.league .card-note')?.textContent).toBe('Resets in 7h\u00a048m');
  });

  it('opens a sheet over the page and gives the page back when it closes', () => {
    const { root, screen } = mount();
    let continued = 0;
    screen.showSheet({
      kind: 'summary',
      title: 'While you were away',
      body: 'Something happened.',
      action: 'Continue',
      onAction: () => continued++,
    });
    const sheet = root.querySelector<HTMLElement>('.overlay.floating')!;
    expect(sheet.hidden).toBe(false);
    expect(root.querySelector('.home-top')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(sheet.querySelector('button'));
    sheet.querySelector('button')!.click();
    expect(continued).toBe(1);
    expect(root.querySelector('.overlay')).toBeNull();
    expect(root.querySelector('.home-top')?.hasAttribute('inert')).toBe(false);
  });
});
