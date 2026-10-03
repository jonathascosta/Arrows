import { head } from '@arrows/engine';
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
import { formatDuration, t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';
import { Hud } from '../ui/hud.ts';
import { Overlay } from '../ui/overlay.ts';

export interface PlayScreenOptions {
  readonly theme: Theme;
  /** The clock for the timer, in milliseconds. */
  readonly now: () => number;
  readonly reducedMotion: () => boolean;
  /** Opens another puzzle (the next level). */
  readonly navigate: (ref: PuzzleRef) => void;
  readonly backHref: string;
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
  private readonly gridButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private readonly gestures = new GestureTracker();
  private readonly disposers: (() => void)[] = [];
  private loaded: LoadedPuzzle | null = null;
  private session: PlaySession | null = null;
  private view: Viewport;
  /** The view when the current pinch started; pinch steps are measured from it. */
  private pinchBase: Viewport | null = null;
  private gridVisible = false;
  private readonly options: PlayScreenOptions;

  constructor(root: HTMLElement, options: PlayScreenOptions) {
    this.options = options;
    const doc = root.ownerDocument;
    const { theme } = options;
    this.hud = new Hud(doc, theme, options.backHref);
    this.stage = el(doc, 'main', { class: 'stage' });
    this.renderer = new BoardRenderer(this.stage, theme, options.reducedMotion);
    this.gridButton = el(
      doc,
      'button',
      {
        class: 'fab grid-toggle',
        type: 'button',
        'aria-pressed': 'false',
        'aria-label': t('hud.gridShow'),
      },
      [iconSpan(doc, theme.icons.grid, 'icon')],
    );
    this.status = el(doc, 'p', { class: 'sr-only', 'aria-live': 'polite' });
    this.overlay = new Overlay(doc);
    this.element = el(doc, 'div', { class: 'play' }, [
      this.hud.topbar,
      this.hud.row,
      this.stage,
      this.gridButton,
      this.status,
      this.overlay.element,
    ]);
    root.replaceChildren(this.element);
    this.view = createViewport(1, 1, boardBounds(1, 1, 0));
    this.listen();
  }

  /** Shows a puzzle from the start. */
  open(ref: PuzzleRef): void {
    this.loaded = loadPuzzle(ref);
    this.session = new PlaySession(this.loaded.puzzle);
    this.hud.setTitle(this.loaded.title, tierLabel(this.loaded.tier), this.loaded.tier);
    this.element.ownerDocument.title = `${this.loaded.title} · ${t('app.name')}`;
    this.start();
    performance.mark(BOARD_READY_MARK);
  }

  destroy(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    this.element.remove();
  }

  // Board lifecycle.

  private start(): void {
    const session = this.session!;
    this.overlay.hide();
    this.renderer.render(session.puzzle);
    this.renderer.setGridVisible(this.gridVisible);
    this.fit();
    this.refresh();
  }

  private restart(): void {
    this.session?.retry();
    this.start();
  }

  private async finish(outcome: 'won' | 'lost'): Promise<void> {
    const session = this.session;
    const loaded = this.loaded;
    if (session === null || loaded === null) return;
    await this.renderer.idle();
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, this.options.theme.motion.settleMs),
    );
    // The player may have moved on while the last arrow was leaving.
    if (this.session !== session) return;
    this.refresh();
    const { state } = session;
    if (outcome === 'lost') {
      this.overlay.show({
        kind: 'lost',
        title: t('lost.title'),
        body: t('lost.body'),
        action: t('lost.retry'),
        onAction: () => this.restart(),
      });
      return;
    }
    const { ref } = loaded;
    this.overlay.show({
      kind: 'won',
      title: t('won.title'),
      body: t('won.summary', {
        time: formatDuration(session.elapsedMs(this.options.now())),
        drops: state.lives,
        total: state.livesAtStart,
      }),
      action: ref.kind === 'level' ? t('won.next') : t('won.again'),
      onAction: () => {
        if (ref.kind === 'level') this.options.navigate({ kind: 'level', level: ref.level + 1 });
        else this.restart();
      },
    });
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
    on(this.gridButton, 'click', () => this.toggleGrid());

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
    switch (result.kind) {
      case 'empty':
        // Double tap on empty space resets the view; taps on arrows always play.
        if (double) {
          this.view = resetView(this.view);
          this.applyView();
        }
        return;
      case 'ignored':
        return;
      case 'removed':
        void this.renderer.remove(result.arrowId, result.rayLength);
        this.refresh();
        if (session.state.status === 'won') void this.finish('won');
        return;
      case 'blocked':
        void this.renderer.bump(result.arrowId, result.blockedBy);
        this.refresh();
        this.announce(t('status.blocked', { n: session.state.lives }));
        if (session.state.status === 'lost') void this.finish('lost');
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
    const arrow = session.puzzle.arrows[id]!;
    this.view = ensureVisible(this.view, cellCenter(head(arrow)), 48);
    this.applyView();
    this.announce(t('status.hint'));
  }

  private toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    this.renderer.setGridVisible(this.gridVisible);
    this.gridButton.setAttribute('aria-pressed', String(this.gridVisible));
    this.gridButton.setAttribute(
      'aria-label',
      t(this.gridVisible ? 'hud.gridHide' : 'hud.gridShow'),
    );
  }

  // Drawing.

  /** Fits the board to the stage, resetting the zoom. */
  private fit(): void {
    const puzzle = this.session?.puzzle;
    if (puzzle === undefined) return;
    const rect = this.stage.getBoundingClientRect();
    // The board fits above the grid button; zoomed in, it may pass under it.
    const button = this.gridButton.getBoundingClientRect();
    const bottom = button.height > 0 ? Math.max(0, rect.bottom - button.top + 8) : 0;
    this.view = createViewport(
      rect.width,
      rect.height,
      boardBounds(puzzle.width, puzzle.height, this.options.theme.board.margin),
      { insets: { top: 8, right: 0, bottom, left: 0 } },
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
    this.hud.setDrops(state.lives, state.livesAtStart);
    this.hud.setHintEnabled(state.status === 'playing');
    this.element.dataset.status = state.status;
    this.element.dataset.arrowsLeft = String(state.remaining.size);
    this.stage.setAttribute('aria-label', t('board.label', { n: state.remaining.size }));
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
