import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme/default.ts';
import { Chances } from './chances.ts';

function mount(reduced: boolean): Chances {
  const chances = new Chances(document, DEFAULT_THEME, () => reduced);
  document.body.replaceChildren(chances.element);
  return chances;
}

const classesOf = (chances: Chances): string[] =>
  [...chances.element.querySelectorAll('.chance')].map((svg) =>
    svg.classList.contains('breaking')
      ? 'breaking'
      : svg.classList.contains('lost')
        ? 'lost'
        : 'intact',
  );

describe('Chances', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('draws the board arrowhead, split in two halves, once per chance', () => {
    const chances = mount(true);
    chances.set(3, 3);
    expect(chances.element.querySelectorAll('svg.chance')).toHaveLength(3);
    expect(chances.element.querySelectorAll('svg.chance path')).toHaveLength(6);
    expect(chances.element.dataset.chances).toBe('3');
    expect(chances.element.getAttribute('aria-label')).toBe('3 of 3 chances left');
    expect(chances.element.dataset.direction).toBe(DEFAULT_THEME.chanceDirection);
  });

  it('with reduced motion, splits at once and holds the red for the break time', async () => {
    const chances = mount(true);
    chances.set(3, 3);
    chances.set(2, 3);
    expect(classesOf(chances)).toEqual(['intact', 'intact', 'breaking']);
    const lostHalf = chances.element.querySelectorAll('.chance')[2]!.querySelector('path')!;
    expect(lostHalf.getAttribute('transform')).toMatch(/rotate\(-18\)/);
    await vi.advanceTimersByTimeAsync(DEFAULT_THEME.motion.chanceBreakMs);
    await chances.idle();
    expect(classesOf(chances)).toEqual(['intact', 'intact', 'lost']);
  });

  it('animates the twist on animation frames when motion is allowed', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const chances = mount(false);
    chances.set(3, 3);
    chances.set(2, 3);
    const half = chances.element.querySelectorAll('.chance')[2]!.querySelector('path')!;
    frames.shift()!(0);
    frames.shift()!(150);
    const mid = /rotate\((-[\d.]+)\)/.exec(half.getAttribute('transform') ?? '');
    expect(Number(mid?.[1])).toBeGreaterThan(-18);
    expect(Number(mid?.[1])).toBeLessThan(0);
    frames.shift()!(1000);
    await vi.advanceTimersByTimeAsync(DEFAULT_THEME.motion.chanceBreakMs);
    await chances.idle();
    expect(classesOf(chances)).toEqual(['intact', 'intact', 'lost']);
  });

  it('breaks several at once and resets on a retry, even mid-break', async () => {
    const chances = mount(true);
    chances.set(3, 3);
    chances.set(1, 3);
    expect(classesOf(chances)).toEqual(['intact', 'breaking', 'breaking']);
    chances.set(3, 3);
    expect(classesOf(chances)).toEqual(['intact', 'intact', 'intact']);
    await vi.advanceTimersByTimeAsync(DEFAULT_THEME.motion.chanceBreakMs);
    await chances.idle();
    // The breaks in flight do not overwrite the reset.
    expect(classesOf(chances)).toEqual(['intact', 'intact', 'intact']);
    expect(chances.element.querySelector('path')?.hasAttribute('transform')).toBe(false);
  });

  it('rebuilds when the total changes', () => {
    const chances = mount(true);
    chances.set(3, 3);
    chances.set(5, 5);
    expect(chances.element.querySelectorAll('.chance')).toHaveLength(5);
    expect(chances.element.getAttribute('aria-label')).toBe('5 of 5 chances left');
  });
});
