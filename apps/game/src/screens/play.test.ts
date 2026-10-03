import { createGame, freeArrows, generateLevel, head, tap } from '@arrows/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellCenter } from '../board/geometry.ts';
import type { PuzzleRef } from '../route.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { BOARD_READY_MARK, PlayScreen } from './play.ts';

const STAGE = { width: 390, height: 600 };

/** jsdom has no layout: give the stage a size so the viewport can fit. */
function sizeStage(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isStage = this.classList.contains('stage');
    const width = isStage ? STAGE.width : 0;
    const height = isStage ? STAGE.height : 0;
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

interface Harness {
  screen: PlayScreen;
  root: HTMLElement;
  navigations: PuzzleRef[];
  clock: { now: number };
}

function mount(ref: PuzzleRef = { kind: 'level', level: 1 }): Harness {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const navigations: PuzzleRef[] = [];
  const clock = { now: 0 };
  const screen = new PlayScreen(root, {
    theme: DEFAULT_THEME,
    now: () => clock.now,
    reducedMotion: () => true,
    navigate: (next) => navigations.push(next),
    backHref: 'dev.html',
  });
  screen.open(ref);
  return { screen, root, navigations, clock };
}

/** Taps the centre of a cell through real pointer events on the stage. */
function tapCell(root: HTMLElement, x: number, y: number): void {
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const transform = root.querySelector('.board-content')!.getAttribute('transform')!;
  const [, tx, ty, scale] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/
    .exec(transform)!
    .map(Number);
  const centre = cellCenter({ x, y });
  const clientX = centre.x * scale! + tx!;
  const clientY = centre.y * scale! + ty!;
  const init = { pointerId: 1, clientX, clientY, button: 0, pointerType: 'touch', bubbles: true };
  stage.dispatchEvent(new PointerEvent('pointerdown', init));
  stage.dispatchEvent(new PointerEvent('pointerup', init));
}

describe('PlayScreen', () => {
  beforeEach(() => {
    sizeStage();
    // Only timers: the screen's performance marks must stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the title, tier, three chances and every arrow', () => {
    const { root } = mount({ kind: 'level', level: 300 });
    expect(root.querySelector('h1')?.textContent).toBe('Level 300');
    expect(root.querySelector('.tier')?.textContent).toBe('Super Hard');
    expect(root.querySelector('.tier')?.getAttribute('data-tier')).toBe('superHard');
    expect(root.querySelectorAll('.chance')).toHaveLength(3);
    expect(root.querySelector('.chances')?.getAttribute('aria-label')).toBe('3 of 3 chances left');
    expect(root.querySelectorAll('[data-arrow]')).toHaveLength(
      generateLevel(300).puzzle.arrows.length,
    );
    expect(performance.getEntriesByName(BOARD_READY_MARK).length).toBeGreaterThan(0);
  });

  it('removes a free arrow on tap and starts the timer', async () => {
    const { root, clock } = mount();
    const { puzzle } = generateLevel(1);
    const id = freeArrows(createGame(puzzle))[0]!;
    const { x, y } = head(puzzle.arrows[id]!);
    clock.now = 1000;
    tapCell(root, x, y);
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector(`[data-arrow="${id}"]`)).toBeNull();
    expect(root.querySelector('.play')?.getAttribute('data-arrows-left')).toBe(
      String(puzzle.arrows.length - 1),
    );
    clock.now = 66_000;
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('.time')?.textContent).toBe('01:05');
  });

  it('costs a chance on a blocked arrow, loses at zero, and retries the whole board', async () => {
    const { root } = mount();
    const { puzzle } = generateLevel(1);
    const play = root.querySelector<HTMLElement>('.play')!;
    const before = [...root.querySelectorAll('.body')].map((p) => p.getAttribute('d'));

    // Clear two arrows first, so a retry that forgot to rebuild the board would show.
    let game = createGame(puzzle);
    for (let i = 0; i < 2; i++) {
      const id = freeArrows(game)[0]!;
      const { x, y } = head(puzzle.arrows[id]!);
      tapCell(root, x, y);
      game = tap(game, id).state;
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length - 2));
    expect(root.querySelectorAll('[data-arrow]')).toHaveLength(puzzle.arrows.length - 2);

    const free = new Set(freeArrows(game));
    const stuck = [...game.remaining].find((id) => !free.has(id))!;
    const { x, y } = puzzle.arrows[stuck]!.cells[0]!;
    tapCell(root, x, y);
    expect(root.querySelector('.chances')?.getAttribute('data-chances')).toBe('2');
    // The rightmost chance breaks in the blocked colour, then settles as lost.
    expect(root.querySelectorAll('.chance.breaking')).toHaveLength(1);
    expect(root.querySelectorAll('.chance')[2]?.classList.contains('breaking')).toBe(true);
    await vi.advanceTimersByTimeAsync(DEFAULT_THEME.motion.chanceBreakMs);
    expect(root.querySelectorAll('.chance.breaking')).toHaveLength(0);
    expect(root.querySelectorAll('.chance.lost')).toHaveLength(1);
    expect(root.querySelector('[aria-live]')?.textContent).toBe('Blocked. 2 chances left.');
    tapCell(root, x, y);
    expect(root.querySelector('[aria-live]')?.textContent).toBe('Blocked. 1 chance left.');
    // A hint is up when the board is lost: the loss clears it.
    root.querySelector<HTMLButtonElement>('.hint')!.click();
    expect(root.querySelectorAll('.hinted')).toHaveLength(1);
    tapCell(root, x, y);
    // The losing tap flashes like any blocked tap; the board is not faded yet.
    expect(root.querySelector(`[data-arrow="${stuck}"]`)?.classList.contains('blocked')).toBe(true);
    expect(play.dataset.status).toBe('lost');
    expect(play.dataset.faded).toBeUndefined();
    expect(root.querySelectorAll('.hinted')).toHaveLength(0);
    expect(root.querySelector('.hint .tool-label')?.textContent).toBe('Hint');
    await vi.advanceTimersByTimeAsync(1000);
    expect(play.dataset.faded).toBe('true');

    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.hidden).toBe(false);
    expect(overlay.dataset.overlay).toBe('lost');
    expect(play.dataset.status).toBe('lost');
    expect(root.querySelectorAll('.chance.lost')).toHaveLength(3);
    expect(overlay.querySelector('h2')?.textContent).toBe('Out of chances');
    expect(overlay.querySelector('p')?.textContent).toBe(
      'Retry plays the same puzzle again, with three fresh chances and the timer reset.',
    );
    expect(overlay.querySelector('a')?.getAttribute('href')).toBe('dev.html');
    expect(overlay.querySelector('a')?.textContent).toBe('Home');
    // Everything behind the sheet is out of reach while it shows.
    for (const selector of ['.topbar', '.stage', '.toolbar']) {
      expect(root.querySelector(selector)?.hasAttribute('inert'), selector).toBe(true);
    }

    overlay.querySelector('button')!.click();
    expect(overlay.hidden).toBe(true);
    expect(root.querySelector('.chances')?.getAttribute('data-chances')).toBe('3');
    expect(root.querySelectorAll('.chance.lost')).toHaveLength(0);
    expect(play.dataset.status).toBe('playing');
    expect(play.dataset.faded).toBeUndefined();
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length));
    expect(root.querySelectorAll('[data-arrow]')).toHaveLength(puzzle.arrows.length);
    expect([...root.querySelectorAll('.body')].map((p) => p.getAttribute('d'))).toEqual(before);
    expect(root.querySelector('.time')?.textContent).toBe('00:00');
    for (const selector of ['.topbar', '.stage', '.toolbar']) {
      expect(root.querySelector(selector)?.hasAttribute('inert'), selector).toBe(false);
    }
    expect(document.activeElement).toBe(root.querySelector('.stage'));
  });

  it('plays a quick double tap on an arrow without resetting the zoom', () => {
    const { root } = mount({ kind: 'level', level: 300 });
    const { puzzle } = generateLevel(300);
    const play = root.querySelector<HTMLElement>('.play')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    const zoom = play.dataset.zoom;
    expect(Number(zoom)).toBeGreaterThan(1);
    // The hint brings a free arrow into the zoomed view.
    root.querySelector<HTMLButtonElement>('.hint')!.click();
    const hinted = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[hinted]!);
    // Both taps land on the same cell: the first removes the arrow, the second finds it empty.
    tapCell(root, x, y);
    tapCell(root, x, y);
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length - 1));
    expect(play.dataset.zoom).toBe(zoom);
    expect(root.querySelector('.chances')?.getAttribute('data-chances')).toBe('3');
  });

  it('wins by following hints and offers the next level', async () => {
    const { root, navigations } = mount();
    const { puzzle } = generateLevel(1);
    for (const _ of puzzle.arrows) {
      root.querySelector<HTMLButtonElement>('.hint')!.click();
      const hinted = root.querySelector('.hinted')!;
      const id = Number(hinted.getAttribute('data-arrow'));
      const { x, y } = head(puzzle.arrows[id]!);
      tapCell(root, x, y);
    }
    await vi.advanceTimersByTimeAsync(1000);
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.dataset.overlay).toBe('won');
    expect(overlay.querySelector('h2')?.textContent).toBe('Solved');
    expect(overlay.textContent).toContain('3 of 3 chances left');
    overlay.querySelector('button')!.click();
    expect(navigations).toEqual([{ kind: 'level', level: 2 }]);
  });

  it('offers play again, not next level, on a daily', async () => {
    const ref: PuzzleRef = { kind: 'daily', dateKey: '2026-10-03' };
    const { root, navigations } = mount(ref);
    const loaded = (await import('../puzzles.ts')).loadPuzzle(ref);
    for (const _ of loaded.puzzle.arrows) {
      root.querySelector<HTMLButtonElement>('.hint')!.click();
      const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
      const { x, y } = head(loaded.puzzle.arrows[id]!);
      tapCell(root, x, y);
    }
    await vi.advanceTimersByTimeAsync(1000);
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.querySelector('button')?.textContent).toBe('Play again');
    overlay.querySelector('button')!.click();
    expect(navigations).toEqual([]);
    expect(root.querySelectorAll('[data-arrow]')).toHaveLength(loaded.puzzle.arrows.length);
  });

  it('labels the hint button "Hint shown" until the hinted arrow is gone', () => {
    const { root } = mount();
    const { puzzle } = generateLevel(1);
    const hint = root.querySelector<HTMLButtonElement>('.hint')!;
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint');
    expect(hint.textContent).toContain('AD');
    hint.click();
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint shown');
    const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint');
  });

  it('zooms with the wheel and keyboard, and toggles the grid', () => {
    const { root } = mount({ kind: 'level', level: 300 });
    const play = root.querySelector<HTMLElement>('.play')!;
    expect(play.dataset.zoom).toBe('1.000');
    root
      .querySelector('.stage')!
      .dispatchEvent(
        new WheelEvent('wheel', { deltaY: -200, clientX: 195, clientY: 300, cancelable: true }),
      );
    expect(Number(play.dataset.zoom)).toBeGreaterThan(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
    expect(play.dataset.zoom).toBe('1.000');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(Number(play.dataset.zoom)).toBeCloseTo(1.25);
    const grid = root.querySelector<HTMLButtonElement>('.grid-toggle')!;
    grid.click();
    expect(grid.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.grid')?.getAttribute('visibility')).toBe('visible');
  });

  it('pans with a drag and resets with a double tap on empty space', () => {
    const { root } = mount({ kind: 'level', level: 300 });
    const play = root.querySelector<HTMLElement>('.play')!;
    const stage = root.querySelector<HTMLElement>('.stage')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    const before = root.querySelector('.board-content')!.getAttribute('transform');
    const pointer = (type: string, x: number, y: number): void => {
      stage.dispatchEvent(
        new PointerEvent(type, { pointerId: 2, clientX: x, clientY: y, pointerType: 'touch' }),
      );
    };
    pointer('pointerdown', 200, 300);
    pointer('pointermove', 240, 330);
    pointer('pointerup', 240, 330);
    expect(root.querySelector('.board-content')!.getAttribute('transform')).not.toBe(before);
    expect(play.dataset.arrowsLeft).toBe(String(generateLevel(300).puzzle.arrows.length));
    // The top-left corner of the stage is outside the board: empty space.
    pointer('pointerdown', 2, 2);
    pointer('pointerup', 2, 2);
    pointer('pointerdown', 3, 3);
    pointer('pointerup', 3, 3);
    expect(play.dataset.zoom).toBe('1.000');
  });

  it('pauses the timer while the page is hidden', async () => {
    const { root, clock } = mount();
    const { puzzle } = generateLevel(1);
    const id = freeArrows(createGame(puzzle))[0]!;
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
    clock.now = 10_000;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    clock.now = 100_000;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    clock.now = 105_000;
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('.time')?.textContent).toBe('00:15');
  });

  it('cleans up its listeners and its clock on destroy', () => {
    const { screen, root } = mount();
    const grid = root.querySelector<HTMLButtonElement>('.grid-toggle')!;
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    screen.destroy();
    expect(root.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    expect(grid.getAttribute('aria-pressed')).toBe('false');
  });
});
