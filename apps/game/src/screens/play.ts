import { head } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import { NO_ADS } from '../ads/ads.ts';
import type { AdProvider } from '../ads/ads.ts';
import type { Haptics } from '../platform/haptics.ts';
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
import { loadPuzzle } from '../puzzles.ts';
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
import { ScoreScreen } from '../ui/score.ts';

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

/** What the score screen can say about a result, when it was recorded. */
export interface ResultNote {
  /** The streak after this win; left out when the win does not count (a replay). */
  readonly streak?: number;
  /** The best time to show; left out on a first win, where it is this time. */
  readonly bestMs?: number;
  /** This time beat an earlier best. */
  readonly newBest?: boolean;
  /** A daily's first win earned its star, and maybe its month's trophy. */
  readonly star?: 'day' | 'month';
  /** The board's points, as the league scores it; left out when the board was lost. */
  readonly score?: number;
  /**
   * League points this board earned, and the player's league and rank after it;
   * left out, with a score, when the board already counted today.
   */
  readonly league?: { readonly points: number; readonly league: string; readonly rank: number };
  /** An event board's first win: where it stands, and the badge when it completed the event. */
  readonly event?: { readonly board: number; readonly total: number; readonly badge?: string };
}

/** What the win sheet's primary button opens instead of playing the board again. */
export interface NextBoard {
  readonly ref: PuzzleRef;
  readonly label: string;
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
  /** The board after a win, if any; when left out, a level leads to the next level. */
  readonly next?: (ref: PuzzleRef) => NextBoard | null;
  /** The interstitial before the score screen and the rewarded ad before a hint; none when left out. */
  readonly ads?: AdProvider;
  /** What a tap did, felt on the phone; nothing when left out. */
  readonly haptics?: Haptics;
}

/** Why the timer is held: the page is hidden, or an ad is playing. */
type Hold = 'hidden' | 'ad';

/** Marks the moment a board is on screen, for tests and profiling. */
export const BOARD_READY_MARK = 'arrows:board-ready';

/**
 * The play screen: HUD, board, grid toggle, the lost sheet and the score
 * screen, and the ads between them. It turns input into session calls and
 * session results into drawing.
 */
export class PlayScreen {
  readonly element: HTMLDivElement;
  private readonly hud: Hud;
  private readonly stage: HTMLElement;
  private readonly renderer: BoardRenderer;
  private readonly overlay: Overlay;
  private readonly score: ScoreScreen;
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
  /** An ad is on screen: the board takes no input until it closes. */
  private adShowing = false;
  private readonly holds = new Set<Hold>();
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
    this.score = new ScoreScreen(doc);
    this.element = el(doc, 'div', { class: 'play' }, [
      this.hud.topbar,
      this.stage,
      this.hud.toolbar,
      this.status,
      this.overlay.element,
      this.score.element,
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
    this.hud.setTitle(this.loaded.title, this.loaded.subtitle, this.loaded.tier);
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
    // The interstitial runs between the win and its score, and nowhere else (docs/PRODUCT.md).
    await this.showAd(() => this.ads.showInterstitial(), undefined);
    if (this.session !== session) return;
    this.showScore(loaded, session);
  }

  /** The score screen for the board just won (docs/DESIGN.md, Win). */
  private showScore(loaded: LoadedPuzzle, session: PlaySession): void {
    const { ref } = loaded;
    const { state } = session;
    const note = this.note ?? {};
    const lines: string[] = [];
    if (note.streak !== undefined) {
      lines.push(note.streak > 0 ? t('won.firstTry', { n: note.streak }) : t('won.streakOver'));
    }
    if (note.star !== undefined && ref.kind === 'daily') {
      lines.push(t('won.star', { day: formatDayShort(ref.dateKey) }));
      if (note.star === 'month') {
        lines.push(t('won.trophy', { month: formatMonth(monthOf(ref.dateKey)) }));
      }
    }
    if (note.event !== undefined) {
      lines.push(t('won.eventBoard', { n: note.event.board, total: note.event.total }));
      if (note.event.badge !== undefined) {
        lines.push(t('won.eventComplete', { badge: note.event.badge }));
      }
    }
    const league =
      note.league !== undefined
        ? t('won.league', {
            points: tn('league.points', note.league.points),
            league: note.league.league,
            rank: ordinal(note.league.rank),
          })
        : note.score !== undefined
          ? t('won.leagueCounted')
          : undefined;
    const best =
      note.newBest === true
        ? t('won.newBest')
        : note.bestMs !== undefined
          ? t('won.best', { time: formatDuration(note.bestMs) })
          : undefined;
    const next =
      this.options.next !== undefined
        ? this.options.next(ref)
        : ref.kind === 'level'
          ? { ref: { kind: 'level', level: ref.level + 1 } as const, label: t('won.next') }
          : null;
    this.coverBoard();
    this.score.show({
      heading: t('won.heading', { title: loaded.title, subtitle: loaded.subtitle }),
      tier: loaded.tier,
      lines,
      time: formatDuration(session.elapsedMs(this.options.now())),
      ...(best !== undefined ? { best } : {}),
      chancesLost: t('won.chancesLostOf', {
        n: state.livesAtStart - state.lives,
        total: state.livesAtStart,
      }),
      ...(note.score !== undefined ? { score: note.score } : {}),
      ...(league !== undefined ? { league } : {}),
      action: next?.label ?? t('won.again'),
      onAction: () => {
        if (next !== null) this.options.navigate(next.ref);
        else this.restart();
      },
      secondary: this.home(),
    });
  }

  private get ads(): AdProvider {
    return this.options.ads ?? NO_ADS;
  }

  /**
   * Shows an ad with the board out of reach and the timer held, and gives its
   * answer; an ad that fails gives `failed` (no reward, or straight on).
   */
  private async showAd<T>(show: () => Promise<T>, failed: T): Promise<T> {
    const focused = this.element.ownerDocument.activeElement;
    this.adShowing = true;
    this.hold('ad');
    // Out of reach while the ad loads too (up to a few seconds), so Back cannot
    // leave the ad to show over another screen.
    this.coverBoard();
    try {
      return await show();
    } catch {
      return failed;
    } finally {
      this.adShowing = false;
      this.release('ad');
      if (!this.overlay.visible && !this.score.visible) {
        for (const element of this.background()) element.toggleAttribute('inert', false);
        if (focused instanceof HTMLElement && focused.isConnected) focused.focus();
      }
    }
  }

  private hold(reason: Hold): void {
    if (this.holds.size === 0) this.session?.pause(this.options.now());
    this.holds.add(reason);
  }

  private release(reason: Hold): void {
    if (!this.holds.delete(reason)) return;
    if (this.holds.size === 0) this.session?.resume(this.options.now());
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

  /** Shows the lost sheet and takes everything behind it out of reach. */
  private showOverlay(content: OverlayContent): void {
    this.coverBoard();
    // A lost board fades only now, under the sheet: until then the losing tap
    // flashes like any other blocked tap.
    if (content.kind === 'lost') this.element.dataset.faded = 'true';
    this.overlay.show(content);
  }

  /** Takes the board and its chrome out of reach, under a sheet or the score screen. */
  private coverBoard(): void {
    for (const element of this.background()) element.toggleAttribute('inert', true);
  }

  /** Hides the lost sheet or the score screen, and gives the board back. */
  private hideOverlay(): void {
    if (!this.overlay.visible && !this.score.visible) return;
    this.overlay.hide();
    this.score.hide();
    delete this.element.dataset.faded;
    for (const element of this.background()) element.toggleAttribute('inert', false);
    this.stage.focus();
  }

  /** A sheet, the score screen or an ad is in front of the board. */
  private get covered(): boolean {
    return this.overlay.visible || this.score.visible || this.adShowing;
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

    on(this.hud.hintButton, 'click', () => void this.showHint());
    on(this.hud.gridButton, 'click', () => this.toggleGrid());

    onTarget(doc, 'keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.target instanceof HTMLButtonElement || this.covered) return;
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
          void this.showHint();
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
      if (doc.visibilityState === 'hidden') this.hold('hidden');
      else this.release('hidden');
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
    if (session === null || this.covered) return;
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
          this.options.haptics?.play('win');
          this.report('won');
          void this.finish('won');
        } else {
          this.options.haptics?.play('remove');
        }
        return;
      case 'blocked':
        void this.renderer.bump(result.arrowId, result.blockedBy);
        // A hint means nothing on a lost board: clear it before the label refreshes.
        if (session.state.status === 'lost') this.renderer.setHint(null);
        this.refresh();
        this.announce(tn('status.blocked', session.state.lives));
        if (session.state.status === 'lost') {
          this.options.haptics?.play('lose');
          this.report('lost');
          void this.finish('lost');
        } else {
          this.options.haptics?.play('block');
        }
        return;
    }
  }

  /**
   * A hint plays a rewarded ad first: no reward, no hint. A hint still on the
   * board is brought into view again without another ad.
   */
  private async showHint(): Promise<void> {
    const session = this.session;
    if (session === null || this.covered) return;
    if (session.state.status !== 'playing') {
      this.announce(t('status.noHint'));
      return;
    }
    const shown = this.renderer.hintedArrow;
    if (shown !== null) {
      this.reveal(session, shown);
      return;
    }
    // "Loading ad…" until it shows; a network ad can take a few seconds.
    this.hud.setHintLoading(true);
    // Null when the ad could not show: no reward either, but nothing was closed early.
    const earned = await this.showAd<boolean | null>(() => this.ads.showRewarded(), null);
    this.hud.setHintLoading(false);
    // The player may have left while the ad played; the board itself took no input.
    if (this.session !== session) return;
    if (earned !== true) {
      this.announce(t(earned === null ? 'status.noAd' : 'status.noReward'));
      return;
    }
    const id = session.hint();
    if (id === null) {
      this.announce(t('status.noHint'));
      return;
    }
    this.renderer.setHint(id);
    this.hud.setHintShown(true);
    this.reveal(session, id);
  }

  /** Brings the hinted arrow into view and says so. */
  private reveal(session: PlaySession, id: number): void {
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
