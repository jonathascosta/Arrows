import { createGame, freeArrows, generateLevel, head } from '@arrows/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.ts';
import { cellCenter } from './board/geometry.ts';
import { PROGRESS_KEY } from './persistence/progress.ts';
import { MemoryStore } from './persistence/store.ts';
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
async function lose(root: HTMLElement, level: number): Promise<void> {
  const { puzzle } = generateLevel(level);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const stuck = puzzle.arrows.findIndex((_, id) => !free.has(id));
  const { x, y } = puzzle.arrows[stuck]!.cells[0]!;
  for (let i = 0; i < game.livesAtStart; i++) tapCell(root, x, y);
  await vi.advanceTimersByTimeAsync(1000);
}

interface Harness {
  app: App;
  root: HTMLElement;
  store: MemoryStore;
  urls: string[];
}

function mount(store = new MemoryStore()): Harness {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const urls: string[] = [];
  const app = new App(root, {
    theme: DEFAULT_THEME,
    store,
    now: () => 0,
    reducedMotion: () => true,
    today: () => '2026-10-03',
    pushUrl: (url) => urls.push(url),
    pickerHref: 'dev.html',
  });
  return { app, root, store, urls };
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
    expect(sheet.textContent).toBe('00:00 · 3 of 3 chances left. First try. Win streak is now 1.');

    // A reload: a new app on the same storage.
    const reloaded = mount(store);
    reloaded.app.show('');
    expect(reloaded.root.querySelector('.levels-card h2')?.textContent).toBe('Level 2');
    expect(reloaded.root.querySelector('.streak')?.textContent).toBe('Streak 1');

    // Next level, from the first app's sheet.
    document.body.replaceChildren(root);
    root.querySelector<HTMLButtonElement>('.overlay button')!.click();
    expect(urls).toEqual(['?level=2']);
    expect(root.querySelector('.play h1')?.textContent).toBe('Level 2');
  });

  it('shows the best time when a level is won again', async () => {
    const { app, root } = mount();
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).toBe(
      '00:00 · 3 of 3 chances left. First try. Win streak is now 2. Best 00:00.',
    );
  });

  it('ends the streak on a lost board, and the retry that wins does not count', async () => {
    const { app, root, store } = mount();
    app.show('?level=1');
    await solve(root, { kind: 'level', level: 1 });
    app.show('?level=2');
    await lose(root, 2);
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!)).toMatchObject({ streak: 0, lostLevel: 2 });
    root.querySelector<HTMLButtonElement>('.overlay button')!.click();
    await solve(root, { kind: 'level', level: 2 });
    expect(root.querySelector('.overlay')?.textContent).toContain(
      'Not on the first try, so the streak starts again.',
    );
    app.show('');
    expect(root.querySelector('.levels-card h2')?.textContent).toBe('Level 3');
    expect(root.querySelector('.streak')?.textContent).toBe('Streak 0');
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

  it('leaves the path and the streak alone on dailies and events', async () => {
    const { app, root, store } = mount();
    const daily: PuzzleRef = { kind: 'daily', dateKey: '2026-10-03' };
    app.show('?daily=2026-10-03');
    await solve(root, daily);
    expect(root.querySelector('.overlay[data-overlay="won"] p')?.textContent).not.toContain(
      'streak',
    );
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
  });
});
