import { drawingMask, BUTTERFLY, generateBoard, generateLevel } from '@arrows/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme/default.ts';
import { BoardRenderer } from './renderer.ts';

function setup(reduced = true): { renderer: BoardRenderer; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  return { renderer: new BoardRenderer(container, DEFAULT_THEME, () => reduced), container };
}

describe('BoardRenderer', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('draws one group per arrow, with a body and a head', () => {
    const { puzzle } = generateLevel(11);
    const { renderer, container } = setup();
    renderer.render(puzzle);
    const groups = container.querySelectorAll('[data-arrow]');
    expect(groups).toHaveLength(puzzle.arrows.length);
    expect(renderer.arrowsDrawn).toBe(puzzle.arrows.length);
    const first = groups[0]!;
    expect(first.querySelector('.body')?.getAttribute('d')).toMatch(/^M[\d. ]+(L[\d. ]+)+$/);
    expect(first.querySelector('.head')?.getAttribute('d')).toMatch(/Z$/);
    expect(container.querySelector('.arrows')?.getAttribute('stroke-width')).toBe(
      String(DEFAULT_THEME.board.strokeWidth),
    );
  });

  it('replaces the previous board on render', () => {
    const { renderer, container } = setup();
    renderer.render(generateLevel(1).puzzle);
    renderer.render(generateLevel(2).puzzle);
    expect(container.querySelectorAll('[data-arrow]')).toHaveLength(
      generateLevel(2).puzzle.arrows.length,
    );
  });

  it('colours drawing arrows from the theme palette', () => {
    const { puzzle } = generateBoard({ id: 't', mask: drawingMask(BUTTERFLY), tier: 'easy' });
    const { renderer, container } = setup();
    renderer.render(puzzle);
    const colours = new Set(
      [...container.querySelectorAll<SVGGElement>('[data-arrow]')].map((g) =>
        g.style.getPropertyValue('--arrow-color'),
      ),
    );
    expect(colours).toEqual(
      new Set(Object.values(BUTTERFLY.legend).map((name) => DEFAULT_THEME.drawingPalette[name])),
    );
  });

  it('toggles the grid, the hint and the transform', () => {
    const { renderer, container } = setup();
    renderer.render(generateLevel(1).puzzle);
    const grid = container.querySelector('.grid')!;
    expect(grid.getAttribute('visibility')).toBe('hidden');
    renderer.setGridVisible(true);
    expect(grid.getAttribute('visibility')).toBe('visible');
    renderer.setHint(3);
    expect(container.querySelector('[data-arrow="3"]')?.classList.contains('hinted')).toBe(true);
    renderer.setHint(4);
    expect(container.querySelectorAll('.hinted')).toHaveLength(1);
    renderer.setHint(null);
    expect(container.querySelectorAll('.hinted')).toHaveLength(0);
    renderer.setTransform('translate(1 2) scale(3)');
    expect(container.querySelector('.board-content')?.getAttribute('transform')).toBe(
      'translate(1 2) scale(3)',
    );
    renderer.setStageSize(390, 600);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 390 600');
  });

  it('removes an arrow, clearing its hint; with reduced motion at once', async () => {
    const { renderer, container } = setup(true);
    renderer.render(generateLevel(1).puzzle);
    renderer.setHint(2);
    const leaving = renderer.remove(2, 3);
    expect(container.querySelectorAll('.hinted')).toHaveLength(0);
    await leaving;
    expect(container.querySelector('[data-arrow="2"]')).toBeNull();
    expect(renderer.hintedArrow).toBeNull();
    expect(renderer.arrowsDrawn).toBe(generateLevel(1).puzzle.arrows.length - 1);
    await renderer.remove(2, 3); // already gone: nothing happens
  });

  it('animates the exit along the track when motion is allowed', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const { renderer, container } = setup(false);
    renderer.render(generateLevel(1).puzzle);
    let finished = false;
    void renderer.remove(0, 2).then(() => (finished = true));
    const group = container.querySelector('[data-arrow="0"]')!;
    expect(group.getAttribute('data-state')).toBe('leaving');
    expect(group.querySelector('.body')?.getAttribute('stroke-dasharray')).toMatch(
      /^[\d.]+ [\d.]+$/,
    );
    frames.shift()!(0);
    frames.shift()!(150);
    expect(Number(group.querySelector('.body')?.getAttribute('stroke-dashoffset'))).toBeLessThan(0);
    expect(group.querySelector('.head')?.getAttribute('transform')).toMatch(/^translate/);
    frames.shift()!(1000);
    await renderer.idle();
    expect(finished).toBe(true);
    expect(group.isConnected).toBe(false);
    vi.unstubAllGlobals();
  });

  it('flashes a blocked arrow and its blocker, then clears them', async () => {
    vi.useFakeTimers();
    const { renderer, container } = setup(true);
    renderer.render(generateLevel(1).puzzle);
    const done = renderer.bump(5, [6]);
    expect(container.querySelector('[data-arrow="5"]')?.classList.contains('blocked')).toBe(true);
    expect(container.querySelector('[data-arrow="6"]')?.classList.contains('blocker')).toBe(true);
    await vi.advanceTimersByTimeAsync(DEFAULT_THEME.motion.shakeMs);
    await done;
    expect(container.querySelectorAll('.blocked, .blocker')).toHaveLength(0);
    expect(container.querySelector('[data-arrow="5"]')?.hasAttribute('transform')).toBe(false);
  });
});
