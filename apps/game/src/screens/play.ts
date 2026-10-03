import { head } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import { cellCenter, boardBounds } from '../board/geometry.ts';
import type { GestureAction } from '../board/gestures.ts';
import { GestureTracker } from '../board/gestures.ts';
import { BoardRenderer } from '../board/renderer.ts';
import {
  cellAt,
  createViewport,
  ensureVisible,
  panBy,
  pinchView,
  resetView,
  transformOf,
  zoomAt,
} from '../board/viewport.ts';
import type { Viewport } from '../board/viewport.ts';
import { PlaySession } from '../game/session.ts';
import { loadPuzzle, tierLabel } from '../puzzles.ts';
import type { LoadedPuzzle } from '../puzzles.ts';
import type { PuzzleRef } from '../route.ts';
import { monthOf } from '../daily/days.ts';
import {
  formatDayShort,
  formatDuration,
  formatMonth,
  ordinal,
  spellOut,
  t,
  tn,
} from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el } from '../ui/dom.ts';
import { Hud } from '../ui/hud.ts';
import { Overlay } from '../ui/overlay.ts';
import type { OverlayContent } from '../ui/overlay.ts';

/** A board that has just been won or lost. */
export interface BoardResult {
  readonly ref: PuzzleRef;
  readonly outcome: 'won' | 'lost';
  readonly elapsedMs: number;
  /** No board was lost on this puzzle before this result. */
  readonly firstTry: boolean;
  /** What the league scores: the board's tier and size, and the chances lost on it. */
  readonly tier: Tier;
  readonly cellCount: number;
  readonly chancesLost: number;
}

/** What the end-of-board sheet can say about a result, when it was recorded. */
export interface ResultNote {
  /** The streak after this win; left out when the win does not count (a replay). */
  readonly streak?: number;
  /** The best time to show; left out on a first win, where it is this time. */
  readonly bestMs?: number;
  /** This time beat an earlier best. */
  readonly newBest?: boolean;
  /** A daily's first win earned its star, and maybe its month's trophy. */
  readonly star?: 'day' | 'month';
  /** League points this board earned, and the player's league and rank after it. */
  readonly league?: { readonly points: number; readonly league: string; readonly rank: number };
}

/** Where leaving a puzzle goes: its back button and the sheets' second link. */
export interface Exit {
  readonly href: string;
  /** The sheets' link text. */
  readonly link: string;
  /** The back button's label for screen readers. */
  readonly back: string;
}

export interface PlayScreenOptions {
  readonly theme: Theme;
  /** The clock for the timer, in milliseconds. */
  readonly now: () => number;
  readonly reducedMotion: () => boolean;
  /** Opens another puzzle (the next level). */
  readonly navigate: (ref: PuzzleRef) => void;
  /** The home screen: the back button and the sheets' Home link. */
  readonly homeHref: string;
  /** Records a result the moment the board is won or lost (progress, streak). */
  readonly record?: (result: BoardResult) => ResultNote | undefined;
  /** Where leaving a puzzle goes; the home screen when left out. */
  readonly exitFor?: (ref: PuzzleRef) => Exit;
}

/** Marks the moment a board is on screen, for tests and profiling. */
export const BOARD_READY_MARK = 'arrows:board-ready';

/**
 * The play screen: HUD, board, grid toggle and the end-of-board overlay. It
 * turns input into session calls and session results into drawing.
 */
export class PlayScreen {
  readonly element: HTMLDivElement;
  private readonly hud: Hud;
  private readonly stage: HTMLElement;
  private readonly renderer: BoardRenderer;
  private readonly overlay: Overlay;
  private readonly status: HTMLParagraphElement;
  private readonly gestures = new GestureTracker();
  private readonly disposers: (() => void)[] = [];
  private loaded: LoadedPuzzle | null = null;
  private session: PlaySession | null = null;
  private view: Viewport;
  /** The view when the current pinch started; pinch steps are measured from it. */
  private pinchBase: Viewport | null = null;
  private gridVisible = false;
  /** Whether the previous tap landed on empty space: a double tap resets only if both did. */
  private lastTapEmpty = false;
  /** Boards lost on this puzzle since it was opened: a win is first-try only at zero. */
  private losses = 0;
  private note: ResultNote | undefined;
  private readonly options: PlayScreenOptions;

  constructor(root: HTMLElement, options: PlayScreenOptions) {
    this.options = options;
    const doc = root.ownerDocument;
    const { theme } = options;
    this.hud = new Hud(doc, theme, options.homeHref, options.reducedMotion);
    // Focusable from script only: focus returns here when an overlay closes.
    this.stage = el(doc, 'main', { class: 'stage', tabindex: '-1' });
    this.renderer = new BoardRenderer(this.stage, theme, options.reducedMotion);
    this.status = el(doc, 'p', { class: 'sr-only', 'aria-live': 'polite' });
    this.overlay = new Overlay(doc);
    this.element = el(doc, 'div', { class: 'play' }, [
      this.hud.topbar,
      this.stage,
      this.hud.toolbar,
      this.status,
      this.overlay.element,
    ]);
    root.replaceChildren(this.element);
    this.view = createViewport(1, 1, boardBounds(1, 1, 0));
    this.listen();
  }

  /** Shows a puzzle from the start. */
  open(ref: PuzzleRef): void {
    this.losses = 0;
    this.note = undefined;
    this.loaded = loadPuzzle(ref);
    this.session = new PlaySession(this.loaded.puzzle);
    this.hud.setTitle(this.loaded.title, tierLabel(this.loaded.tier), this.loaded.tier);
    const exit = this.exit();
    this.hud.setBack(exit.href, exit.back);
    this.element.ownerDocument.title = `${this.loaded.title} · ${t('app.name')}`;
    this.start();
    performance.mark(BOARD_READY_MARK);
  }

  destroy(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    // A board still finishing sees that it is gone and stops.
    this.session = null;
    this.loaded = null;
    this.element.remove();
  }

  // Board lifecycle.

  private start(): void {
    const session = this.session!;
    this.hideOverlay();
    this.lastTapEmpty = false;
    this.renderer.render(session.puzzle);
    this.renderer.setGridVisible(this.gridVisible);
    this.fit();
    this.refresh();
  }

  private restart(): void {
    this.note = undefined;
    this.session?.retry();
    this.start();
  }

  /** Reports the outcome at once, so leaving during the last animation still counts. */
  private report(outcome: 'won' | 'lost'): void {
    const session = this.session;
    const loaded = this.loaded;
    if (session === null || loaded === null) return;
    const { state } = session;
    this.note = this.options.record?.({
      ref: loaded.ref,
      outcome,
      elapsedMs: session.elapsedMs(this.options.now()),
      firstTry: this.losses === 0,
      tier: loaded.tier,
      cellCount: loaded.analysis.cellCount,
      chancesLost: state.livesAtStart - state.lives,
    });
    if (outcome === 'lost') this.losses++;
  }

  private async finish(outcome: 'won' | 'lost'): Promise<void> {
    const session = this.session;
    const loaded = this.loaded;
    if (session === null || loaded === null) return;
    await Promise.all([this.renderer.idle(), this.hud.chancesIdle()]);
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, this.options.theme.motion.settleMs),
    );
    // The player may have moved on while the last arrow was leaving.
    if (this.session !== session) return;
    this.refresh();
    const { state } = session;
    if (outcome === 'lost') {
      this.showOverlay({
        kind: 'lost',
        title: t('lost.title'),
        body: t('lost.body', { total: spellOut(state.livesAtStart) }),
        action: t('lost.retry'),
        onAction: () => this.restart(),
        secondary: this.home(),
      });
      return;
    }
    const { ref } = loaded;
    const lines = [
      t('won.summary', {
        time: formatDuration(session.elapsedMs(this.options.now())),
        chances: state.lives,
        total: state.livesAtStart,
      }),
    ];
    const note = this.note;
    if (note !== undefined) {
      if (note.streak !== undefined) {
        lines.push(note.streak > 0 ? t('won.firstTry', { n: note.streak }) : t('won.streakOver'));
      }
      if (note.star !== undefined && ref.kind === 'daily') {
        lines.push(t('won.star', { day: formatDayShort(ref.dateKey) }));
        if (note.star === 'month') {
          lines.push(t('won.trophy', { month: formatMonth(monthOf(ref.dateKey)) }));
        }
      }
      if (note.league !== undefined) {
        lines.push(
          t('won.league', {
            points: tn('league.points', note.league.points),
            league: note.league.league,
            rank: ordinal(note.league.rank),
          }),
        );
      }
      if (note.newBest === true) lines.push(t('won.newBest'));
      else if (note.bestMs !== undefined) {
        lines.push(t('won.best', { time: formatDuration(note.bestMs) }));
      }
    }
    this.showOverlay({
      kind: 'won',
      title: t('won.title'),
      body: lines.join(' '),
      action: ref.kind === 'level' ? t('won.next') : t('won.again'),
      onAction: () => {
        if (ref.kind === 'level') this.options.navigate({ kind: 'level', level: ref.level + 1 });
        else this.restart();
      },
      secondary: this.home(),
    });
  }

  private exit(): Exit {
    const ref = this.loaded?.ref;
    if (ref !== undefined && this.options.exitFor !== undefined) return this.options.exitFor(ref);
    return { href: this.options.homeHref, link: t('nav.home'), back: t('nav.back') };
  }

  /** The sheets' second link: home, or wherever this puzzle came from. */
  private home(): { label: string; href: string } {
    const exit = this.exit();
    return { label: exit.link, href: exit.href };
  }

  /** Shows the end-of-board card and takes everything behind it out of reach. */
  private showOverlay(content: OverlayContent): void {
    for (const element of this.background()) element.toggleAttribute('inert', true);
    // A lost board fades only now, under the sheet: until then the losing tap
    // flashes like any other blocked tap.
    if (content.kind === 'lost') this.element.dataset.faded = 'true';
    this.overlay.show(content);
  }

  private hideOverlay(): void {
    if (!this.overlay.visible) return;
    this.overlay.hide();
    delete this.element.dataset.faded;
    for (const element of this.background()) element.toggleAttribute('inert', false);
    this.stage.focus();
  }

  private background(): HTMLElement[] {
    return [this.hud.topbar, this.stage, this.hud.toolbar];
  }

  // Input.

  private listen(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, handler, options);
      this.disposers.push(() => target.removeEventListener(type, handler, options));
    };
    const onTarget = (target: EventTarget, type: string, handler: (event: Event) => void): void => {
      target.addEventListener(type, handler);
      this.disposers.push(() => target.removeEventListener(type, handler));
    };
    const doc = this.element.ownerDocument;

    on(this.stage, 'pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      try {
        this.stage.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers cannot be captured; the gesture still works.
      }
      const p = this.local(event);
      this.apply(this.gestures.down(event.pointerId, p.x, p.y, event.timeStamp));
    });
    on(this.stage, 'pointermove', (event) => {
      const p = this.local(event);
      this.apply(this.gestures.move(event.pointerId, p.x, p.y));
    });
    on(this.stage, 'pointerup', (event) => {
      this.apply(this.gestures.up(event.pointerId, event.timeStamp));
    });
    on(this.stage, 'pointercancel', (event) => {
      this.apply(this.gestures.cancel(event.pointerId));
    });
    on(
      this.stage,
      'wheel',
      (event) => {
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.view.stageHeight : 1;
        // Trackpad pinches arrive as wheel events with ctrlKey; they need more gain.
        const gain = event.ctrlKey ? 0.01 : 0.002;
        const p = this.local(event);
        this.view = zoomAt(this.view, Math.exp(-event.deltaY * unit * gain), p.x, p.y);
        this.applyView();
      },
      { passive: false },
    );
    on(this.stage, 'contextmenu', (event) => event.preventDefault());

    on(this.hud.hintButton, 'click', () => this.showHint());
    on(this.hud.gridButton, 'click', () => this.toggleGrid());

    onTarget(doc, 'keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.target instanceof HTMLButtonElement || this.overlay.visible) return;
      const centre = { x: this.view.stageWidth / 2, y: this.view.stageHeight / 2 };
      switch (event.key) {
        case '+':
        case '=':
          this.view = zoomAt(this.view, 1.25, centre.x, centre.y);
          break;
        case '-':
          this.view = zoomAt(this.view, 0.8, centre.x, centre.y);
          break;
        case '0':
          this.view = resetView(this.view);
          break;
        case 'h':
          this.showHint();
          return;
        case 'g':
          this.toggleGrid();
          return;
        default:
          return;
      }
      this.applyView();
    });

    onTarget(doc, 'visibilitychange', () => {
      const now = this.options.now();
      if (doc.visibilityState === 'hidden') this.session?.pause(now);
      else this.session?.resume(now);
    });

    const ResizeObserverImpl = globalThis.ResizeObserver as typeof ResizeObserver | undefined;
    if (ResizeObserverImpl !== undefined) {
      const observer = new ResizeObserverImpl(() => this.fit());
      observer.observe(this.stage);
      this.disposers.push(() => observer.disconnect());
    } else {
      const view = doc.defaultView;
      if (view !== null) onTarget(view, 'resize', () => this.fit());
    }

    const clock = globalThis.setInterval(() => this.tick(), 250);
    this.disposers.push(() => globalThis.clearInterval(clock));
  }

  private local(event: MouseEvent): { x: number; y: number } {
    const rect = this.stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private apply(actions: readonly GestureAction[]): void {
    let moved = false;
    for (const action of actions) {
      switch (action.kind) {
        case 'tap':
          this.tapAt(action.x, action.y, action.double);
          break;
        case 'pan':
          this.view = panBy(this.view, action.dx, action.dy);
          moved = true;
          break;
        case 'pinch':
          this.pinchBase ??= this.view;
          this.view = pinchView(
            this.pinchBase,
            action.factor,
            action.fromX,
            action.fromY,
            action.x,
            action.y,
          );
          moved = true;
          break;
        case 'pinchEnd':
          this.pinchBase = null;
          break;
      }
    }
    if (moved) this.applyView();
  }

  private tapAt(x: number, y: number, double: boolean): void {
    const session = this.session;
    if (session === null || this.overlay.visible) return;
    const cell = cellAt(this.view, x, y);
    const result = session.tapCell(cell.x, cell.y, this.options.now());
    const previousEmpty = this.lastTapEmpty;
    this.lastTapEmpty = result.kind === 'empty';
    switch (result.kind) {
      case 'empty':
        // A double tap resets the view only when both taps were on empty space: the
        // second tap of a quick double tap on an arrow lands where the arrow just was.
        if (double && previousEmpty) {
          this.view = resetView(this.view);
          this.applyView();
        }
        return;
      case 'ignored':
        return;
      case 'removed':
        void this.renderer.remove(result.arrowId, result.rayLength);
        this.refresh();
        if (session.state.status === 'won') {
          this.report('won');
          void this.finish('won');
        }
        return;
      case 'blocked':
        void this.renderer.bump(result.arrowId, result.blockedBy);
        // A hint means nothing on a lost board: clear it before the label refreshes.
        if (session.state.status === 'lost') this.renderer.setHint(null);
        this.refresh();
        this.announce(tn('status.blocked', session.state.lives));
        if (session.state.status === 'lost') {
          this.report('lost');
          void this.finish('lost');
        }
        return;
    }
  }

  private showHint(): void {
    const session = this.session;
    if (session === null || this.overlay.visible) return;
    const id = session.hint();
    if (id === null) {
      this.announce(t('status.noHint'));
      return;
    }
    this.renderer.setHint(id);
    this.hud.setHintShown(true);
    const arrow = session.puzzle.arrows[id]!;
    this.view = ensureVisible(this.view, cellCenter(head(arrow)), 48);
    this.applyView();
    this.announce(t('status.hint'));
  }

  private toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    this.renderer.setGridVisible(this.gridVisible);
    // The label stays "Grid"; aria-pressed carries the state.
    this.hud.gridButton.setAttribute('aria-pressed', String(this.gridVisible));
  }

  // Drawing.

  /** Fits the board to the stage, resetting the zoom. */
  private fit(): void {
    const puzzle = this.session?.puzzle;
    if (puzzle === undefined) return;
    const rect = this.stage.getBoundingClientRect();
    this.view = createViewport(
      rect.width,
      rect.height,
      boardBounds(puzzle.width, puzzle.height, this.options.theme.board.margin),
      { insets: { top: 8, right: 0, bottom: 8, left: 0 } },
    );
    this.renderer.setStageSize(this.view.stageWidth, this.view.stageHeight);
    this.applyView();
  }

  private applyView(): void {
    this.renderer.setTransform(transformOf(this.view));
    this.element.dataset.zoom = (this.view.scale / this.view.fitScale).toFixed(3);
  }

  private refresh(): void {
    const session = this.session;
    if (session === null) return;
    const { state } = session;
    this.hud.setChances(state.lives, state.livesAtStart);
    this.hud.setHintEnabled(state.status === 'playing');
    this.hud.setHintShown(this.renderer.hintedArrow !== null);
    this.element.dataset.status = state.status;
    this.element.dataset.arrowsLeft = String(state.remaining.size);
    this.stage.setAttribute('aria-label', tn('board.label', state.remaining.size));
    this.tick();
  }

  private tick(): void {
    if (this.session !== null) {
      this.hud.setTime(formatDuration(this.session.elapsedMs(this.options.now())));
    }
  }

  private announce(message: string): void {
    this.status.textContent = message;
  }
}
