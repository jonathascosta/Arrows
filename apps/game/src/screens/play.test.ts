import { createGame, freeArrows, generateLevel, head, tap } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdProvider } from '../ads/ads.ts';
import type { HapticCue } from '../platform/haptics.ts';
import { cellCenter } from '../board/geometry.ts';
import type { PuzzleRef } from '../route.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { BOARD_READY_MARK, PlayScreen } from './play.ts';
import type { BoardResult, ResultNote } from './play.ts';

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
  results: BoardResult[];
  clock: { now: number };
}

/** Ads that stay on screen until the test closes them, and count what they showed. */
class FakeAds implements AdProvider {
  interstitials = 0;
  rewarded = 0;
  private readonly open: ((reward: boolean) => void)[] = [];

  showInterstitial(): Promise<void> {
    this.interstitials++;
    return new Promise((resolve) => this.open.push(() => resolve()));
  }

  showRewarded(): Promise<boolean> {
    this.rewarded++;
    return new Promise((resolve) => this.open.push(resolve));
  }

  get showing(): boolean {
    return this.open.length > 0;
  }

  /** Closes the ad on screen: watched to the end (the reward) or not. */
  async close(reward = true): Promise<void> {
    this.open.shift()!(reward);
    await settle();
  }
}

/** Lets promises settle: the ads (none, or a fake) answer through them. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function pressHint(root: HTMLElement): Promise<void> {
  root.querySelector<HTMLButtonElement>('.hint')!.click();
  await settle();
}

function mount(
  ref: PuzzleRef = { kind: 'level', level: 1 },
  note?: (result: BoardResult) => ResultNote | undefined,
  ads?: AdProvider,
): Harness {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const navigations: PuzzleRef[] = [];
  const results: BoardResult[] = [];
  const clock = { now: 0 };
  const screen = new PlayScreen(root, {
    theme: DEFAULT_THEME,
    now: () => clock.now,
    reducedMotion: () => true,
    navigate: (next) => navigations.push(next),
    homeHref: './',
    record: (result) => {
      results.push(result);
      return note?.(result);
    },
    ...(ads !== undefined ? { ads } : {}),
  });
  screen.open(ref);
  return { screen, root, navigations, results, clock };
}

/** Removes every arrow by following the hints, the way a stuck player could. */
async function solveWithHints(root: HTMLElement, arrows: number): Promise<void> {
  const { puzzle } = generateLevel(1);
  for (let i = 0; i < arrows; i++) {
    await pressHint(root);
    const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
  }
}

/** Wins a board by tapping free arrows, without a hint. */
async function solveByTaps(root: HTMLElement, puzzle: Puzzle): Promise<void> {
  let game = createGame(puzzle);
  while (game.status === 'playing') {
    const id = freeArrows(game)[0]!;
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
    game = tap(game, id).state;
  }
  await settle();
}

/** Taps a blocked arrow of level 1 until the board is lost. */
function loseLevelOne(root: HTMLElement): void {
  const { puzzle } = generateLevel(1);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const stuck = [...game.remaining].find((id) => !free.has(id))!;
  const { x, y } = puzzle.arrows[stuck]!.cells[0]!;
  for (let i = 0; i < game.livesAtStart; i++) tapCell(root, x, y);
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
    await pressHint(root);
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
    expect(overlay.querySelector('a')?.getAttribute('href')).toBe('./');
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

  it('plays a quick double tap on an arrow without resetting the zoom', async () => {
    const { root } = mount({ kind: 'level', level: 300 });
    const { puzzle } = generateLevel(300);
    const play = root.querySelector<HTMLElement>('.play')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    const zoom = play.dataset.zoom;
    expect(Number(zoom)).toBeGreaterThan(1);
    // The hint brings a free arrow into the zoomed view.
    await pressHint(root);
    const hinted = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[hinted]!);
    // Both taps land on the same cell: the first removes the arrow, the second finds it empty.
    tapCell(root, x, y);
    tapCell(root, x, y);
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length - 1));
    expect(play.dataset.zoom).toBe(zoom);
    expect(root.querySelector('.chances')?.getAttribute('data-chances')).toBe('3');
  });

  it('wins by following hints and shows the score screen, which offers the next level', async () => {
    const { root, navigations, clock } = mount();
    const { puzzle } = generateLevel(1);
    for (const _ of puzzle.arrows) {
      await pressHint(root);
      const hinted = root.querySelector('.hinted')!;
      const id = Number(hinted.getAttribute('data-arrow'));
      const { x, y } = head(puzzle.arrows[id]!);
      tapCell(root, x, y);
      clock.now += 1500;
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector<HTMLElement>('.overlay')!.hidden).toBe(true);
    const score = root.querySelector<HTMLElement>('.score-screen')!;
    expect(score.hidden).toBe(false);
    expect(score.getAttribute('role')).toBe('dialog');
    expect(score.querySelector('.score-heading')?.textContent).toBe('Level 1 · Easy');
    expect(score.querySelector('.score-heading')?.getAttribute('data-tier')).toBe('easy');
    expect(score.querySelector('h2')?.textContent).toBe('Solved');
    const rows = [...score.querySelectorAll<HTMLElement>('.score-row')].map((row) => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent,
      row.hidden,
    ]);
    // The timer ran from the first tap to the last.
    const time = `00:${String(Math.floor(((puzzle.arrows.length - 1) * 1500) / 1000)).padStart(2, '0')}`;
    expect(rows).toEqual([
      ['Time', time, false],
      ['Chances lost', '0 of 3', false],
      // Nothing recorded this board: no score, no league line.
      ['Score', '', true],
    ]);
    expect(score.querySelector<HTMLElement>('.score-league')!.hidden).toBe(true);
    expect(score.querySelector<HTMLElement>('.score-lines')!.hidden).toBe(true);
    for (const selector of ['.topbar', '.stage', '.toolbar']) {
      expect(root.querySelector(selector)?.hasAttribute('inert'), selector).toBe(true);
    }
    expect(document.activeElement).toBe(score.querySelector('button'));
    expect(score.querySelector('a')?.getAttribute('href')).toBe('./');
    expect(score.querySelector('a')?.textContent).toBe('Home');
    score.querySelector('button')!.click();
    expect(navigations).toEqual([{ kind: 'level', level: 2 }]);
  });

  it('records each result once, with first try false after a lost board', async () => {
    const { root, results, clock } = mount();
    const { puzzle } = generateLevel(1);
    loseLevelOne(root);
    const { analysis } = generateLevel(1);
    expect(results).toEqual([
      {
        ref: { kind: 'level', level: 1 },
        outcome: 'lost',
        elapsedMs: 0,
        firstTry: true,
        tier: 'easy',
        cellCount: analysis.cellCount,
        chancesLost: 3,
      },
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    root.querySelector<HTMLElement>('.overlay button')!.click();
    clock.now = 5000;
    await solveWithHints(root, puzzle.arrows.length);
    // Recorded at the winning tap, before the last arrow has left.
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ outcome: 'won', firstTry: false, chancesLost: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(results).toHaveLength(2);
  });

  it('counts a first try again when another puzzle opens', async () => {
    const { screen, root, results } = mount();
    loseLevelOne(root);
    await vi.advanceTimersByTimeAsync(1000);
    screen.open({ kind: 'level', level: 1 });
    await solveWithHints(root, generateLevel(1).puzzle.arrows.length);
    expect(results.at(-1)).toMatchObject({ outcome: 'won', firstTry: true });
  });

  it('tells what the win did, the best time, the score and the league points', async () => {
    const notes: ResultNote[] = [
      { streak: 4, score: 38, league: { points: 38, league: 'Gold', rank: 8 } },
      { streak: 0, bestMs: 2000, newBest: true, score: 21 },
      { bestMs: 61_000, newBest: false, score: 17 },
    ];
    const { screen, root } = mount({ kind: 'level', level: 1 }, () => notes.shift());
    const arrows = generateLevel(1).puzzle.arrows.length;
    const shown = (selector: string): string | null => {
      const element = root.querySelector<HTMLElement>(`.score-screen ${selector}`)!;
      return element.hidden ? null : element.textContent;
    };

    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown('.score-lines')).toBe('First try. Win streak is now 4.');
    expect(shown('.score-best')).toBeNull();
    expect(shown('.score-total')).toBe('38');
    expect(shown('.score-league')).toBe('+38 points in Gold league · now 8th.');
    // A new best on a level lost before; the board already counted in today's league.
    screen.open({ kind: 'level', level: 1 });
    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown('.score-lines')).toBe('Not on the first try, so the streak starts again.');
    expect(shown('.score-best')).toBe('new best');
    expect(shown('.score-total')).toBe('21');
    expect(shown('.score-league')).toBe('Already counted in today’s league.');
    // A replay: no line under "Solved", the best time next to this one.
    screen.open({ kind: 'level', level: 1 });
    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown('.score-lines')).toBeNull();
    expect(shown('.score-best')).toBe('best 01:01');
    expect(shown('.score-time')).toBe('00:00');
    // Nothing recorded: the time and the chances only.
    screen.open({ kind: 'level', level: 1 });
    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown('.score-lines')).toBeNull();
    expect(shown('.score-best')).toBeNull();
    expect(root.querySelector<HTMLElement>('.score-screen .score')!.hidden).toBe(true);
    expect(shown('.score-league')).toBeNull();
  });

  it('says where an event board stands, and opens what `next` names', async () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const navigations: PuzzleRef[] = [];
    const notes: ResultNote[] = [
      { event: { board: 2, total: 6 } },
      { event: { board: 6, total: 6, badge: 'Autumn 2026 badge' } },
    ];
    const screen = new PlayScreen(root, {
      theme: DEFAULT_THEME,
      now: () => 0,
      reducedMotion: () => true,
      navigate: (next) => navigations.push(next),
      homeHref: './',
      record: () => notes.shift(),
      next: () => ({ ref: { kind: 'level', level: 9 }, label: 'Next board' }),
    });
    screen.open({ kind: 'level', level: 1 });
    const arrows = generateLevel(1).puzzle.arrows.length;
    const body = (): string | null | undefined =>
      root.querySelector('.score-screen .score-lines')?.textContent;
    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(body()).toBe('Board 2 of 6 done.');
    const button = root.querySelector<HTMLButtonElement>('.score-screen button')!;
    expect(button.textContent).toBe('Next board');
    button.click();
    expect(navigations).toEqual([{ kind: 'level', level: 9 }]);
    screen.open({ kind: 'level', level: 1 });
    await solveWithHints(root, arrows);
    await vi.advanceTimersByTimeAsync(1000);
    expect(body()).toBe('Board 6 of 6 done. Every board won: the Autumn 2026 badge is yours!');
    screen.destroy();
  });

  it('offers play again, not next level, on a daily', async () => {
    const ref: PuzzleRef = { kind: 'daily', dateKey: '2026-10-03' };
    const { root, navigations } = mount(ref);
    const loaded = (await import('../puzzles.ts')).loadPuzzle(ref);
    for (const _ of loaded.puzzle.arrows) {
      await pressHint(root);
      const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
      const { x, y } = head(loaded.puzzle.arrows[id]!);
      tapCell(root, x, y);
    }
    await vi.advanceTimersByTimeAsync(1000);
    const score = root.querySelector<HTMLElement>('.score-screen')!;
    // A Saturday: the weekend's board is hard.
    expect(score.querySelector('.score-heading')?.textContent).toBe('Daily · Oct 3, 2026 · Hard');
    expect(score.querySelector('button')?.textContent).toBe('Play again');
    score.querySelector('button')!.click();
    expect(navigations).toEqual([]);
    expect(score.hidden).toBe(true);
    expect(root.querySelectorAll('[data-arrow]')).toHaveLength(loaded.puzzle.arrows.length);
    expect(document.activeElement).toBe(root.querySelector('.stage'));
  });

  it('labels the hint button "Hint shown" until the hinted arrow is gone', async () => {
    const { root } = mount();
    const { puzzle } = generateLevel(1);
    const hint = root.querySelector<HTMLButtonElement>('.hint')!;
    const marks = [...hint.querySelectorAll<HTMLElement>('.sr-only, .ad-badge')];
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint');
    expect(marks.map((mark) => [mark.textContent, mark.hidden])).toEqual([
      ['(plays an ad)', false],
      ['AD', false],
    ]);
    await pressHint(root);
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint shown');
    // Showing the same hint again plays no ad, so the button no longer says it does.
    expect(marks.every((mark) => mark.hidden)).toBe(true);
    const id = Number(root.querySelector('.hinted')!.getAttribute('data-arrow'));
    const { x, y } = head(puzzle.arrows[id]!);
    tapCell(root, x, y);
    expect(hint.querySelector('.tool-label')?.textContent).toBe('Hint');
    expect(marks.some((mark) => mark.hidden)).toBe(false);
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

  it('stops a board that was finishing when the screen is destroyed', async () => {
    const { screen, root, results } = mount();
    await solveWithHints(root, generateLevel(1).puzzle.arrows.length);
    expect(results).toHaveLength(1);
    const score = root.querySelector<HTMLElement>('.score-screen')!;
    screen.destroy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(score.hidden).toBe(true);
  });

  it('shows the interstitial once per board won, between the win and the score screen', async () => {
    const ads = new FakeAds();
    const { screen, root, navigations } = mount({ kind: 'level', level: 1 }, undefined, ads);
    const { puzzle } = generateLevel(1);
    const score = root.querySelector<HTMLElement>('.score-screen')!;
    for (let board = 1; board <= 2; board++) {
      await solveByTaps(root, puzzle);
      await vi.advanceTimersByTimeAsync(1000);
      expect(ads.interstitials).toBe(board);
      // The ad is on screen: no score yet, and the board takes no input.
      expect(ads.showing).toBe(true);
      expect(score.hidden).toBe(true);
      await vi.advanceTimersByTimeAsync(5000);
      expect(ads.interstitials).toBe(board);
      await ads.close();
      expect(score.hidden).toBe(false);
      expect(ads.interstitials).toBe(board);
      screen.open({ kind: 'level', level: 1 });
    }
    // No hint was asked for, so no rewarded ad showed.
    expect(ads.rewarded).toBe(0);
    expect(navigations).toEqual([]);
  });

  it('shows no ad for a lost board, nor after the player has left', async () => {
    const ads = new FakeAds();
    const { screen, root } = mount({ kind: 'level', level: 1 }, undefined, ads);
    loseLevelOne(root);
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector<HTMLElement>('.overlay')!.dataset.overlay).toBe('lost');
    expect(ads.interstitials).toBe(0);
    // Won, and gone during the interstitial: no score screen comes after it.
    root.querySelector<HTMLButtonElement>('.overlay button')!.click();
    await solveByTaps(root, generateLevel(1).puzzle);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ads.interstitials).toBe(1);
    const score = root.querySelector<HTMLElement>('.score-screen')!;
    screen.destroy();
    await ads.close();
    expect(score.hidden).toBe(true);
  });

  it('gives a hint only for a rewarded ad watched to the end, with the timer held', async () => {
    const ads = new FakeAds();
    const { root, clock } = mount({ kind: 'level', level: 1 }, undefined, ads);
    const { puzzle } = generateLevel(1);
    const play = root.querySelector<HTMLElement>('.play')!;
    const label = root.querySelector('.hint .tool-label')!;
    const status = root.querySelector('[aria-live]')!;
    let game = createGame(puzzle);
    const first = freeArrows(game)[0]!;
    clock.now = 1000;
    tapCell(root, head(puzzle.arrows[first]!).x, head(puzzle.arrows[first]!).y);
    game = tap(game, first).state;
    clock.now = 5000;

    await pressHint(root);
    expect(ads.rewarded).toBe(1);
    // While the ad plays the board takes no input: no tap, no second ad.
    const next = freeArrows(game)[0]!;
    tapCell(root, head(puzzle.arrows[next]!).x, head(puzzle.arrows[next]!).y);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    await settle();
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length - 1));
    expect(ads.rewarded).toBe(1);
    clock.now = 65_000;
    await ads.close(false);
    expect(root.querySelectorAll('.hinted')).toHaveLength(0);
    expect(label.textContent).toBe('Hint');
    expect(status.textContent).toBe('No hint: the ad was closed before the end.');
    // The minute under the ad did not count.
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('.time')?.textContent).toBe('00:04');

    await pressHint(root);
    await ads.close(true);
    expect(ads.rewarded).toBe(2);
    expect(root.querySelectorAll('.hinted')).toHaveLength(1);
    expect(label.textContent).toBe('Hint shown');
    expect(status.textContent).toBe('Try the highlighted arrow.');
    // The hint still on the board shows again without another ad.
    await pressHint(root);
    expect(ads.rewarded).toBe(2);
    expect(ads.showing).toBe(false);
    expect(root.querySelectorAll('.hinted')).toHaveLength(1);
  });

  it('keeps the timer held while the page is hidden during an ad, until both are over', async () => {
    const ads = new FakeAds();
    const { root, clock } = mount({ kind: 'level', level: 1 }, undefined, ads);
    const { puzzle } = generateLevel(1);
    const first = freeArrows(createGame(puzzle))[0]!;
    tapCell(root, head(puzzle.arrows[first]!).x, head(puzzle.arrows[first]!).y);
    clock.now = 2000;
    await pressHint(root);
    // Hidden and shown again while the ad still plays: the clock stays stopped.
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    clock.now = 30_000;
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    clock.now = 60_000;
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('.time')?.textContent).toBe('00:02');
    await ads.close();
    clock.now = 63_000;
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('.time')?.textContent).toBe('00:05');
  });

  it('gives no hint to another board opened while an ad played', async () => {
    const ads = new FakeAds();
    const { screen, root } = mount({ kind: 'level', level: 1 }, undefined, ads);
    await pressHint(root);
    screen.open({ kind: 'level', level: 2 });
    const { puzzle } = generateLevel(2);
    const play = root.querySelector<HTMLElement>('.play')!;
    // The ad is still on screen: the new board takes no input under it.
    const id = freeArrows(createGame(puzzle))[0]!;
    tapCell(root, head(puzzle.arrows[id]!).x, head(puzzle.arrows[id]!).y);
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length));
    await ads.close(true);
    expect(root.querySelectorAll('.hinted')).toHaveLength(0);
    expect(root.querySelector('.hint .tool-label')?.textContent).toBe('Hint');
    // Once it has closed, the new board plays.
    tapCell(root, head(puzzle.arrows[id]!).x, head(puzzle.arrows[id]!).y);
    expect(play.dataset.arrowsLeft).toBe(String(puzzle.arrows.length - 1));
  });

  it('plays a haptic cue for what each tap did', async () => {
    const cues: HapticCue[] = [];
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const screen = new PlayScreen(root, {
      theme: DEFAULT_THEME,
      now: () => 0,
      reducedMotion: () => true,
      navigate: () => undefined,
      homeHref: './',
      haptics: { play: (cue) => cues.push(cue) },
    });
    screen.open({ kind: 'level', level: 1 });
    const { puzzle } = generateLevel(1);
    // A tap on empty space is nothing.
    const stage = root.querySelector<HTMLElement>('.stage')!;
    stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: 1, clientY: 1 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: 1, clientY: 1 }));
    expect(cues).toEqual([]);
    await solveByTaps(root, puzzle);
    const removes = Array.from({ length: puzzle.arrows.length - 1 }, (): HapticCue => 'remove');
    expect(cues).toEqual([...removes, 'win']);
    cues.length = 0;
    screen.open({ kind: 'level', level: 1 });
    loseLevelOne(root);
    expect(cues).toEqual(['block', 'block', 'lose']);
    screen.destroy();
  });

  it('covers the board while an ad loads or plays, and gives it back after', async () => {
    const ads = new FakeAds();
    const { root } = mount({ kind: 'level', level: 1 }, undefined, ads);
    const hint = root.querySelector<HTMLButtonElement>('.hint')!;
    const label = hint.querySelector('.tool-label')!;
    hint.focus();
    await pressHint(root);
    for (const selector of ['.topbar', '.stage', '.toolbar']) {
      expect(root.querySelector(selector)?.hasAttribute('inert'), selector).toBe(true);
    }
    expect(label.textContent).toBe('Loading ad…');
    await ads.close(false);
    for (const selector of ['.topbar', '.stage', '.toolbar']) {
      expect(root.querySelector(selector)?.hasAttribute('inert'), selector).toBe(false);
    }
    expect(label.textContent).toBe('Hint');
    expect(document.activeElement).toBe(hint);
    await pressHint(root);
    await ads.close(true);
    expect(label.textContent).toBe('Hint shown');
  });

  it('plays no haptic cue for a tap the board does not take', async () => {
    const cues: HapticCue[] = [];
    const ads = new FakeAds();
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const screen = new PlayScreen(root, {
      theme: DEFAULT_THEME,
      now: () => 0,
      reducedMotion: () => true,
      navigate: () => undefined,
      homeHref: './',
      ads,
      haptics: { play: (cue) => cues.push(cue) },
    });
    screen.open({ kind: 'level', level: 1 });
    const { puzzle } = generateLevel(1);
    const id = freeArrows(createGame(puzzle))[0]!;
    // Under the rewarded ad.
    await pressHint(root);
    tapCell(root, head(puzzle.arrows[id]!).x, head(puzzle.arrows[id]!).y);
    await ads.close(false);
    expect(cues).toEqual([]);
    // Under the score screen.
    await solveByTaps(root, puzzle);
    await vi.advanceTimersByTimeAsync(1000);
    await ads.close();
    cues.length = 0;
    tapCell(root, head(puzzle.arrows[id]!).x, head(puzzle.arrows[id]!).y);
    expect(cues).toEqual([]);
    screen.destroy();
  });

  it('takes an ad that fails as no reward, and goes on to the score screen', async () => {
    const failing: AdProvider = {
      showInterstitial: () => Promise.reject(new Error('no ad to show')),
      showRewarded: () => Promise.reject(new Error('no ad to show')),
    };
    const { root } = mount({ kind: 'level', level: 1 }, undefined, failing);
    await pressHint(root);
    expect(root.querySelectorAll('.hinted')).toHaveLength(0);
    expect(root.querySelector('[aria-live]')?.textContent).toBe('No hint: no ad could be shown.');
    await solveByTaps(root, generateLevel(1).puzzle);
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector<HTMLElement>('.score-screen')!.hidden).toBe(false);
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
