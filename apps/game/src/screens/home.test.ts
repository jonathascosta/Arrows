import { describe, expect, it } from 'vitest';
import { SimulatedLeagueProvider } from '../league/simulated.ts';
import { INITIAL_PROGRESS } from '../persistence/progress.ts';
import { MemoryStore } from '../persistence/store.ts';
import { loadPuzzle } from '../puzzles.ts';
import type { Progress } from '../persistence/progress.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { EVENT_REF, HomeScreen } from './home.ts';

function mount(progress: Partial<Progress> = {}): { root: HTMLElement; screen: HomeScreen } {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const screen = new HomeScreen(root, {
    theme: DEFAULT_THEME,
    progress: { ...INITIAL_PROGRESS, ...progress },
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

  it('opens the calendar, the league and the event board', () => {
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
    const event = root.querySelector('a.event-card')!;
    expect(EVENT_REF).toEqual({ kind: 'drawing', drawingId: 'butterfly', tier: 'hard' });
    expect(event.getAttribute('href')).toBe('./?drawing=butterfly&tier=hard');
    expect(event.textContent).toContain('Butterfly');
    // The thumbnail is the event board itself, drawn small.
    expect(event.querySelectorAll('.event-thumb [data-arrow]')).toHaveLength(
      loadPuzzle(EVENT_REF).puzzle.arrows.length,
    );
    expect(event.querySelector('.event-thumb')?.getAttribute('aria-hidden')).toBe('true');
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
