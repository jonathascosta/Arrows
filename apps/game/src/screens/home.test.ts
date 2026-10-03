import { describe, expect, it } from 'vitest';
import { INITIAL_PROGRESS } from '../persistence/progress.ts';
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

  it('opens today’s daily and the event board, and holds the league until it exists', () => {
    const { root } = mount();
    const daily = root.querySelector('a.daily')!;
    expect(daily.getAttribute('href')).toBe('./?daily=2026-10-03');
    expect(daily.textContent).toContain('Sat 3 Oct');
    // Not a link, and drawn as one that opens nothing yet.
    const league = root.querySelector('.league')!;
    expect(league.tagName).toBe('DIV');
    expect(league.querySelector('a')).toBeNull();
    expect(league.getAttribute('data-soon')).toBe('true');
    expect(league.textContent).toContain('Opens soon');
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
});
