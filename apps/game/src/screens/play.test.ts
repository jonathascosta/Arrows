import { createGame, freeArrows, generateLevel, head } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
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

function blocked(puzzle: Puzzle): number {
  const free = new Set(freeArrows(createGame(puzzle)));
  return puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
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

  it('shows the title, tier, three drops and every arrow', () => {
    const { root } = mount({ kind: 'level', level: 300 });
    expect(root.querySelector('h1')?.textContent).toBe('Level 300');
    expect(root.querySelector('.tier')?.textContent).toBe('Super Hard');
    expect(root.querySelector('.tier')?.getAttribute('data-tier')).toBe('superHard');
    expect(root.querySelectorAll('.drop')).toHaveLength(3);
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

  it('costs a drop on a blocked arrow, loses at zero, and retries the same board', async () => {
    const { root } = mount();
    const { puzzle } = generateLevel(1);
    const id = blocked(puzzle);
    const { x, y } = puzzle.arrows[id]!.cells[0]!;
    tapCell(root, x, y);
    expect(root.querySelector('.drops')?.getAttribute('data-lives')).toBe('2');
    expect(root.querySelectorAll('.drop.lost')).toHaveLength(1);
    expect(root.querySelector('[aria-live]')?.textContent).toBe('Blocked. 2 drops left.');
    tapCell(root, x, y);
    tapCell(root, x, y);
    await vi.advanceTimersByTimeAsync(1000);
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.hidden).toBe(false);
    expect(overlay.dataset.overlay).toBe('lost');
    const before = [...root.querySelectorAll('.body')].map((p) => p.getAttribute('d'));
    overlay.querySelector('button')!.click();
    expect(overlay.hidden).toBe(true);
    expect(root.querySelector('.drops')?.getAttribute('data-lives')).toBe('3');
    expect([...root.querySelectorAll('.body')].map((p) => p.getAttribute('d'))).toEqual(before);
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
    expect(overlay.textContent).toContain('3 of 3 drops left');
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

  it('cleans up its listeners on destroy', () => {
    const { screen, root } = mount();
    screen.destroy();
    expect(root.childElementCount).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
  });
});
