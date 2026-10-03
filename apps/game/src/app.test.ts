import { createGame, freeArrows, head, scoreBoard } from '@arrows/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.ts';
import { cellCenter } from './board/geometry.ts';
import { DAILY_KEY, DailyStore } from './persistence/daily.ts';
import { EVENTS_KEY } from './persistence/events.ts';
import { LEAGUE_KEY } from './persistence/league.ts';
import { PROGRESS_KEY, ProgressStore } from './persistence/progress.ts';
import { MemoryStore } from './persistence/store.ts';
import { SimulatedLeagueProvider } from './league/simulated.ts';
import { loadPuzzle } from './puzzles.ts';
import type { PuzzleRef } from './route.ts';
import { DEFAULT_THEME } from './theme/default.ts';

/** jsdom has no layout: give the board's stage a size so taps land on cells. */
function sizeStage(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isStage = this.classList.contains('stage');
    const width = isStage ? 390 : 0;
    const height = isStage ? 600 : 0;
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    };
  });
}

function tapCell(root: HTMLElement, x: number, y: number): void {
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const transform = root.querySelector('.stage .board-content')!.getAttribute('transform')!;
  const [, tx, ty, scale] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/
    .exec(transform)!
    .map(Number);
  const centre = cellCenter({ x, y });
  const init = {
    pointerId: 1,
    clientX: centre.x * scale! + tx!,
    clientY: centre.y * scale! + ty!,
    button: 0,
    pointerType: 'touch',
    bubbles: true,
  };
  stage.dispatchEvent(new PointerEvent('pointerdown', init));
  stage.dispatchEvent(new PointerEvent('pointerup', init));
}

/** Wins the open board by following the hints. */
async function solve(root: HTMLElement, ref: PuzzleRef): Promise<void> {
  const { puzzle } = loadPuzzle(ref);
  for (const _ of puzzle.arrows) {
    root.querySelector<HTMLButtonElement>('.hint')!.click();
    const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
  }
  await vi.advanceTimersByTimeAsync(1000);
}

/** Taps an arrow that is blocked at the start until the board is lost. */
async function loseBoard(root: HTMLElement, ref: PuzzleRef): Promise<void> {
  const { puzzle } = loadPuzzle(ref);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const stuck = puzzle.arrows.findIndex((_, id) => !free.has(id));
  const { x, y } = puzzle.arrows[stuck]!.cells[0]!;
  for (let i = 0; i < game.livesAtStart; i++) tapCell(root, x, y);
  await vi.advanceTimersByTimeAsync(1000);
}

const lose = (root: HTMLElement, level: number): Promise<void> =>
  loseBoard(root, { kind: 'level', level });

interface Harness {
  app: App;
  root: HTMLElement;
  store: MemoryStore;
  urls: string[];
  replaced: string[];
}

/** Local noon on a day: the app's wall clock in these tests. */
function noon(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d, 12, 0);
}

/** The wall clock is local noon on `today`, or `today` itself when it is a clock. */
function mount(store = new MemoryStore(), today: string | (() => Date) = '2026-10-03'): Harness {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const urls: string[] = [];
  const replaced: string[] = [];
  const app = new App(root, {
    theme: DEFAULT_THEME,
    store,
    now: () => 0,
    reducedMotion: () => true,
    clock: typeof today === 'string' ? () => noon(today) : today,
    pushUrl: (url) => urls.push(url),
    replaceUrl: (url) => replaced.push(url),
    pickerHref: 'dev.html',
  });
  return { app, root, store, urls, replaced };
}

describe('App', () => {
  beforeEach(() => {
    sizeStage();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the home screen with no puzzle in the address, or a bad one', () => {
    const { app, root } = mount();
    for (const search of ['', '?level=0', '?drawing=nope']) {
      app.show(search);
      expect(root.querySelector('.home'), search).not.toBeNull();
      expect(root.querySelector('.play'), search).toBeNull();
    }
  });

  it('shows a puzzle, and one screen at a time', () => {
    const { app, root } = mount();
    app.show('?level=3');
    expect(root.querySelector('.play h1')?.textContent).toBe('Level 3');
    expect(root.querySelector('.home')).toBeNull();
    expect(root.querySelector('.back')?.getAttribute('href')).toBe('./');
    app.show('');
    expect(root.querySelector('.play')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    app.show('?daily=2026-10-03');
    expect(root.querySelector('.play h1')?.textContent).toBe('Daily · Oct 3, 2026');
    expect(root.childElementCount).toBe(1);
  });

  it('moves the path on a win, keeps it across a reload, and opens the next level', async () => {
    const { app, root, store, urls } = mount();
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    const sheet = root.querySelector('.overlay[data-overlay="won"] p')!;
    // A first win: no earlier best time to show.
    // The streak, then the league's points for the board.
    expect(sheet.textContent).toMatch(
      /^00:00 · 3 of 3 chances left\. First try\. Win streak is now 1\. \+\d+ points in Bronze league · now \d+(st|nd|rd|th)\.$/,
    );

    // A reload: a new app on the same storage.
    const reloaded = mount(store);
    reloaded.app.show('');
    expect(reloaded.root.querySelector('.levels-card h2')?.textContent).toBe('Level 2');
    expect(reloaded.root.querySelector('.streak .sr-only')?.textContent).toBe('Win streak: 1');

    // Next level, from the first app's sheet.
    document.body.replaceChildren(root);
    root.querySelector<HTMLButtonElement>('.overlay button')!.click();
    expect(urls).toEqual(['?level=2']);
    expect(root.querySelector('.play h1')?.textContent).toBe('Level 2');
  });

  it('shows the best time on a replay, which leaves the streak alone', async () => {
    const { app, root } = mount();
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toBe(
      '00:00 · 3 of 3 chances left. Best 00:00.',
    );
    app.show('');
    expect(root.querySelector('.streak .sr-only')?.textContent).toBe('Win streak: 1');
  });

  it('draws the home screen again from storage on refresh, and leaves a board alone', () => {
    const { app, root, store } = mount();
    app.show('');
    expect(root.querySelector('.levels-card h2')?.textContent).toBe('Level 1');
    // Another tab, or this page before the browser cached it, saved progress since.
    new ProgressStore(store).recordWin({ level: 1, elapsedMs: 1000, firstTry: true });
    app.refresh();
    expect(root.querySelector('.levels-card h2')?.textContent).toBe('Level 2');
    expect(root.querySelector('.streak .sr-only')?.textContent).toBe('Win streak: 1');
    app.show('?level=2');
    const board = root.querySelector('.play');
    app.refresh();
    expect(root.querySelector('.play')).toBe(board);
    expect(root.querySelector('.home')).toBeNull();
  });

  it('ends the streak on a lost board, and the retry that wins does not count', async () => {
    const { app, root, store } = mount();
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    app.show('?level=2');
    await lose(root, 2);
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!)).toMatchObject({ streak: 0, lostLevels: [2] });
    root.querySelector<HTMLButtonElement>('.overlay button')!.click();
    await solve(root, { kind: 'level', level: 2 });
    expect(root.querySelector('.overlay')?.textContent).toContain(
      'Not on the first try, so the streak starts again.',
    );
    app.show('');
    expect(root.querySelector('.levels-card h2')?.textContent).toBe('Level 3');
    expect(root.querySelector('.streak .sr-only')?.textContent).toBe('Win streak: 0');
  });

  it('counts no streak for a level lost, left and won after a reload', async () => {
    const first = mount();
    first.app.show('?level=1');
    await lose(first.root, 1);
    const { app, root } = mount(first.store);
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    expect(root.querySelector('.overlay')?.textContent).toContain(
      'Not on the first try, so the streak starts again.',
    );
  });

  it('leaves the path and the streak alone on dailies and events, won or lost', async () => {
    const { app, root, store } = mount();
    const daily: PuzzleRef = { kind: 'daily', dateKey: '2026-10-03' };
    app.show('?daily=2026-10-03');
    await solve(root, daily);
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toMatch(
      /^00:00 · 3 of 3 chances left\. A star for Sat 3 Oct\. \+\d+ points in Bronze league/,
    );
    app.show('?daily=2026-10-02');
    await loseBoard(root, { kind: 'daily', dateKey: '2026-10-02' });
    app.show('?drawing=butterfly&tier=hard');
    await loseBoard(root, { kind: 'drawing', drawingId: 'butterfly', tier: 'hard' });
    expect(root.querySelector('.overlay')?.getAttribute('data-overlay')).toBe('lost');
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('stores a won day, not a lost one, and the calendar shows it after a reload', async () => {
    const { app, root, store } = mount();
    app.show('?daily=2026-10-01');
    await loseBoard(root, { kind: 'daily', dateKey: '2026-10-01' });
    expect(store.getItem(DAILY_KEY)).toBeNull();
    app.show('?daily=2026-10-02');
    await solve(root, { kind: 'daily', dateKey: '2026-10-02' });
    expect(JSON.parse(store.getItem(DAILY_KEY)!)).toMatchObject({
      days: { '2026-10-02': { bestMs: 0 } },
    });

    const reloaded = mount(store);
    reloaded.app.show('?calendar');
    const day = (n: string) => reloaded.root.querySelector(`[data-day="2026-10-${n}"]`);
    expect(day('02')?.getAttribute('data-state')).toBe('done');
    expect(day('01')?.getAttribute('data-state')).toBe('open');
    expect(reloaded.root.querySelector('.month-stars')?.textContent).toBe('1 of 31 stars');
    reloaded.app.show('');
    expect(reloaded.root.querySelector('.daily-stars .sr-only')?.textContent).toBe(
      '1 of 31 stars this month',
    );
  });

  it('shows the best time when a day is won again', async () => {
    const { app, root } = mount();
    const ref: PuzzleRef = { kind: 'daily', dateKey: '2026-10-02' };
    app.show('?daily=2026-10-02');
    await solve(root, ref);
    app.show('?daily=2026-10-02');
    await solve(root, ref);
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toBe(
      '00:00 · 3 of 3 chances left. Best 00:00.',
    );
  });

  it('awards the trophy with the last day of a month', async () => {
    const store = new MemoryStore();
    const days: Record<string, { bestMs: number }> = {};
    for (let day = 1; day < 30; day++) {
      days[`2026-09-${String(day).padStart(2, '0')}`] = { bestMs: 1000 };
    }
    store.setItem(DAILY_KEY, JSON.stringify({ version: 1, days }));
    const { app, root } = mount(store);
    app.show('?daily=2026-09-30');
    await solve(root, { kind: 'daily', dateKey: '2026-09-30' });
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toContain(
      'A star for Wed 30 Sep. Every day of September 2026 won: a trophy!',
    );
    app.show('?calendar');
    expect(root.querySelector('.trophy.complete .sr-only')?.textContent).toBe(
      'September 2026: trophy, every day won',
    );
  });

  it('shows the trophy of today’s month as soon as its last day is won', async () => {
    const store = new MemoryStore();
    const days: Record<string, { bestMs: number }> = {};
    for (let day = 1; day < 30; day++) {
      days[`2026-09-${String(day).padStart(2, '0')}`] = { bestMs: 1000 };
    }
    store.setItem(DAILY_KEY, JSON.stringify({ version: 1, days }));
    const { app, root } = mount(store, '2026-09-30');
    app.show('?daily=2026-09-30');
    await solve(root, { kind: 'daily', dateKey: '2026-09-30' });
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toContain(
      'Every day of September 2026 won: a trophy!',
    );
    app.show('?calendar');
    expect(root.querySelector('.month-stars')?.textContent).toBe('30 of 30 stars');
    expect(root.querySelector('.trophy.complete .sr-only')?.textContent).toBe(
      'September 2026: trophy, every day won',
    );
  });

  it('keeps focus on the same control when a refresh redraws the calendar', () => {
    const { app, root, store } = mount();
    app.show('?calendar');
    root.querySelector<HTMLElement>('[data-day="2026-10-02"]')!.focus();
    new DailyStore(store).recordWin('2026-10-02', 1000, '2026-10-03');
    app.refresh();
    const day = root.querySelector<HTMLElement>('[data-day="2026-10-02"]')!;
    expect(day.dataset.state).toBe('done');
    expect(document.activeElement).toBe(day);
    root.querySelector<HTMLElement>('.month-head .previous')!.focus();
    app.refresh();
    expect(document.activeElement).toBe(root.querySelector('.month-head .previous'));
  });

  it('opens the calendar instead of a day ahead or before the first daily', () => {
    const { app, root, replaced } = mount();
    app.show('?daily=2026-10-04');
    expect(root.querySelector('.play')).toBeNull();
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-10');
    expect(replaced).toEqual(['?calendar=2026-10']);
    app.show('?daily=2027-03-01');
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-10');
    app.show('?daily=2025-12-31');
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-01');
    expect(replaced).toEqual(['?calendar=2026-10', '?calendar=2026-10', '?calendar=2026-01']);
    // Today and earlier days open.
    app.show('?daily=2026-10-03');
    expect(root.querySelector('.play h1')?.textContent).toBe('Daily · Oct 3, 2026');
  });

  it('shows the calendar for a month, keeping it inside the calendar', () => {
    const { app, root, replaced } = mount();
    app.show('?calendar');
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-10');
    expect(replaced).toEqual([]);
    app.show('?calendar=2026-07');
    expect(root.querySelector('.month-title h2')?.textContent).toBe('July 2026');
    app.show('?calendar=2031-01');
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-10');
    expect(replaced).toEqual(['?calendar=2026-10']);
  });

  it('moves between months in place, keeping the address and the focus in step', () => {
    const { app, root, replaced } = mount();
    app.show('?calendar');
    root.querySelector<HTMLButtonElement>('.month-head .previous')!.click();
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-09');
    expect(replaced).toEqual(['?calendar=2026-09']);
    expect(document.activeElement).toBe(root.querySelector('.month-head .previous'));
    root.querySelector<HTMLButtonElement>('.month-head .next')!.click();
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-10');
    // Next is disabled on today's month: focus moves to the other button.
    expect(root.querySelector<HTMLButtonElement>('.month-head .next')!.disabled).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('.month-head .previous'));
    // A refresh redraws the month shown, not today's.
    root.querySelector<HTMLButtonElement>('.month-head .previous')!.click();
    app.refresh();
    expect(root.querySelector('.calendar')?.getAttribute('data-month')).toBe('2026-09');
  });

  it('leads a daily back to its month in the calendar', async () => {
    const { app, root } = mount();
    app.show('?daily=2026-09-12');
    const back = root.querySelector('.topbar .back')!;
    expect(back.getAttribute('href')).toBe('./?calendar=2026-09');
    expect(back.getAttribute('aria-label')).toBe('Back to the calendar');
    await loseBoard(root, { kind: 'daily', dateKey: '2026-09-12' });
    const link = root.querySelector('.overlay a')!;
    expect(link.textContent).toBe('Calendar');
    expect(link.getAttribute('href')).toBe('./?calendar=2026-09');
    // A level leads home again in the same screen.
    app.show('?level=2');
    expect(root.querySelector('.topbar .back')?.getAttribute('href')).toBe('./');
    expect(root.querySelector('.topbar .back')?.getAttribute('aria-label')).toBe('Back to home');
  });

  it('shows the league, and counts a board once a day', async () => {
    const { app, root } = mount();
    app.show('?league');
    expect(root.querySelector('.league-name')?.textContent).toBe('Bronze');
    expect(root.querySelectorAll('.league-row')).toHaveLength(30);
    expect(root.querySelector<HTMLElement>('.league-join')?.hidden).toBe(false);

    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    expect(root.querySelector('.overlay p')?.textContent).toMatch(/points in Bronze league/);
    // The same board again the same day: no league line.
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    expect(root.querySelector('.overlay p')?.textContent).not.toMatch(/league/);

    app.show('?league');
    expect(root.querySelector<HTMLElement>('.league-join')?.hidden).toBe(true);
    app.show('');
    expect(root.querySelector('a.league .card-title')?.textContent).toMatch(/^Bronze · \d+/);
  });

  it('says how yesterday ended on the first home screen of the day, once', () => {
    const store = new MemoryStore();
    // Yesterday: a winning day in Bronze.
    new SimulatedLeagueProvider(store, 'You').record(
      {
        key: 'level:900',
        tier: 'superHard',
        cellCount: 2000,
        timeSeconds: 1,
        chancesLost: 0,
        event: false,
      },
      noon('2026-10-02'),
    );
    const { app, root } = mount(store, '2026-10-03');
    app.show('');
    const sheet = root.querySelector<HTMLElement>('.overlay[data-overlay="summary"]')!;
    expect(sheet.querySelector('h2')?.textContent).toBe('While you were away');
    expect(sheet.querySelector('p')?.textContent).toMatch(
      /^You finished 1st in Bronze on Fri 2 Oct, with \d+ points, and moved up to Silver\.$/,
    );
    expect(sheet.querySelector('a')?.getAttribute('href')).toBe('./?league');
    expect(root.querySelector('a.league .card-title')?.textContent).toBe('Silver');
    sheet.querySelector('button')!.click();
    // Seen: neither the home screen nor the league shows it again.
    app.show('');
    expect(root.querySelector('.overlay')).toBeNull();
    app.show('?league');
    expect(root.querySelector<HTMLElement>('.overlay')?.hidden).toBe(true);
    expect(root.querySelector('.league-name')?.textContent).toBe('Silver');
  });

  it('shows the summary once, wherever it shows first', () => {
    const yesterday = (): MemoryStore => {
      const store = new MemoryStore();
      new SimulatedLeagueProvider(store, 'You').record(
        {
          key: 'level:900',
          tier: 'superHard',
          cellCount: 2000,
          timeSeconds: 1,
          chancesLost: 0,
          event: false,
        },
        noon('2026-10-02'),
      );
      return store;
    };
    // On the home screen, then "See the league" without Continue.
    const first = mount(yesterday(), '2026-10-03');
    first.app.show('');
    expect(first.root.querySelector('.overlay[data-overlay="summary"]')).not.toBeNull();
    first.app.show('?league');
    expect(first.root.querySelector<HTMLElement>('.overlay')?.hidden).toBe(true);
    // In the league, then back to the home screen without Continue.
    const second = mount(yesterday(), '2026-10-03');
    second.app.show('?league');
    expect(second.root.querySelector('.overlay')?.getAttribute('data-overlay')).toBe('summary');
    second.app.show('');
    expect(second.root.querySelector('.overlay')).toBeNull();
  });

  it('plays an event’s boards in order while it runs', () => {
    const { app, root, replaced } = mount();
    app.show('?event=autumn-2026&board=1');
    expect(root.querySelector('.play h1')?.textContent).toBe('Maple leaf');
    expect(root.querySelector('.play .tier')?.textContent).toBe('Autumn · 1 of 6');
    // A board further on than the next opens the next one instead.
    app.show('?event=autumn-2026&board=4');
    expect(root.querySelector('.play .tier')?.textContent).toBe('Autumn · 1 of 6');
    expect(replaced).toEqual(['?event=autumn-2026&board=1']);
  });

  it('opens no event board before the event or after it', () => {
    for (const day of ['2026-09-20', '2026-12-05']) {
      const { app, root, replaced } = mount(new MemoryStore(), day);
      app.show('?event=autumn-2026&board=1');
      expect(root.querySelector('.play'), day).toBeNull();
      expect(root.querySelector('.home'), day).not.toBeNull();
      expect(replaced).toEqual(['']);
    }
  });

  it('counts a board won, scores it with the event bonus, and offers the next board', async () => {
    const { app, root, store, urls } = mount();
    const ref: PuzzleRef = { kind: 'event', eventId: 'autumn-2026', board: 1 };
    app.show('?event=autumn-2026&board=1');
    await solve(root, ref);
    const sheet = root.querySelector('.overlay[data-overlay="won"]')!;
    expect(sheet.querySelector('p')?.textContent).toMatch(
      /^00:00 · 3 of 3 chances left\. Board 1 of 6 done\. \+\d+ points in Bronze league/,
    );
    expect(JSON.parse(store.getItem(EVENTS_KEY)!)).toEqual({
      version: 1,
      events: { 'autumn-2026': [1] },
    });
    const { analysis } = loadPuzzle(ref);
    expect(JSON.parse(store.getItem(LEAGUE_KEY)!)).toMatchObject({
      points: scoreBoard({
        tier: 'medium',
        cellCount: analysis.cellCount,
        timeSeconds: 0,
        mistakes: 0,
        event: true,
      }),
      boards: ['event:autumn-2026:1'],
    });
    const next = sheet.querySelector('button')!;
    expect(next.textContent).toBe('Next board');
    next.click();
    expect(urls).toEqual(['?event=autumn-2026&board=2']);
    expect(root.querySelector('.play h1')?.textContent).toBe('Acorn');
    app.show('');
    expect(root.querySelector('a.event-card')?.getAttribute('href')).toBe(
      './?event=autumn-2026&board=2',
    );
  });

  it('counts a board won after the last day for nothing but the league', async () => {
    const store = new MemoryStore();
    store.setItem(
      EVENTS_KEY,
      JSON.stringify({ version: 1, events: { 'autumn-2026': [1, 2, 3, 4] } }),
    );
    // Opened a minute before the event ends, won two minutes later.
    let clock = new Date(2026, 10, 30, 23, 59);
    const { app, root } = mount(store, () => clock);
    const ref: PuzzleRef = { kind: 'event', eventId: 'autumn-2026', board: 5 };
    app.show('?event=autumn-2026&board=5');
    expect(root.querySelector('.play .tier')?.textContent).toBe('Autumn · 5 of 6');
    clock = new Date(2026, 11, 1, 0, 1);
    await solve(root, ref);
    const sheet = root.querySelector('.overlay[data-overlay="won"]')!;
    expect(sheet.querySelector('p')?.textContent).toMatch(
      /^00:00 · 3 of 3 chances left\. \+\d+ points in Bronze league/,
    );
    expect(sheet.querySelector('button')?.textContent).toBe('Play again');
    expect(JSON.parse(store.getItem(EVENTS_KEY)!)).toEqual({
      version: 1,
      events: { 'autumn-2026': [1, 2, 3, 4] },
    });
    const { tier, analysis } = loadPuzzle(ref);
    expect(JSON.parse(store.getItem(LEAGUE_KEY)!)).toMatchObject({
      day: '2026-12-01',
      points: scoreBoard({
        tier,
        cellCount: analysis.cellCount,
        timeSeconds: 0,
        mistakes: 0,
        event: false,
      }),
      boards: ['event:autumn-2026:5'],
    });
    app.show('');
    expect(root.querySelector('.event-card .card-note')?.textContent).toBe(
      '4 of 6 boards · Ended Mon 30 Nov',
    );
  });

  it('earns the badge with the last board', async () => {
    const store = new MemoryStore();
    store.setItem(
      EVENTS_KEY,
      JSON.stringify({ version: 1, events: { 'autumn-2026': [1, 2, 3, 4, 5] } }),
    );
    const { app, root } = mount(store);
    app.show('?event=autumn-2026&board=6');
    await solve(root, { kind: 'event', eventId: 'autumn-2026', board: 6 });
    const sheet = root.querySelector('.overlay[data-overlay="won"]')!;
    expect(sheet.querySelector('p')?.textContent).toContain(
      'Board 6 of 6 done. Every board won: the Autumn 2026 badge is yours!',
    );
    expect(sheet.querySelector('button')?.textContent).toBe('Play again');
    app.show('');
    expect(root.querySelector('.event-card .badge-earned')?.textContent).toBe('Badge earned');
    // Every board is open again for a replay, which counts for nothing new.
    app.show('?event=autumn-2026&board=2');
    expect(root.querySelector('.play .tier')?.textContent).toBe('Autumn · 2 of 6');
  });
});
