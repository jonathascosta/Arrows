import { scoreBoard } from '@arrows/engine';
import type { AdProvider } from './ads/ads.ts';
import type { Haptics } from './platform/haptics.ts';
import type { DateKey, MonthKey } from './daily/days.ts';
import { isPlayableDay, localDateKey, monthOf } from './daily/days.ts';
import { clampMonth } from './daily/month.ts';
import { DailyStore } from './persistence/daily.ts';
import { ProgressStore } from './persistence/progress.ts';
import type { KeyValueStore } from './persistence/store.ts';
import type { PuzzleRef, Route } from './route.ts';
import {
  calendarHref,
  HOME_HREF,
  LEAGUE_HREF,
  parseRoute,
  puzzleKey,
  routeSearch,
} from './route.ts';
import { CalendarScreen } from './screens/calendar.ts';
import { HomeScreen } from './screens/home.ts';
import type { HomeEvent } from './screens/home.ts';
import { daysLeft, eventOn, eventState, findEvent } from './events/catalog.ts';
import { EventStore } from './persistence/events.ts';
import { LeagueScreen, summaryText } from './screens/league.ts';
import type { LeagueProvider } from './league/provider.ts';
import { SimulatedLeagueProvider } from './league/simulated.ts';
import { PlayScreen } from './screens/play.ts';
import type { BoardResult, Exit, NextBoard, ResultNote } from './screens/play.ts';
import { t } from './strings.ts';
import type { Theme } from './theme/theme.ts';

export interface AppOptions {
  readonly theme: Theme;
  readonly store: KeyValueStore;
  readonly now: () => number;
  readonly reducedMotion: () => boolean;
  /** The wall clock: the local day, the league's time of day and its countdown. */
  readonly clock: () => Date;
  /** Pushes an address onto the browser history (no reload). */
  readonly pushUrl: (url: string) => void;
  /** Replaces the current address (no reload, no new history entry). */
  readonly replaceUrl: (url: string) => void;
  readonly pickerHref: string;
  /** The interstitial and the rewarded ad (docs/PRODUCT.md, Monetization); none when left out. */
  readonly ads?: AdProvider;
  /** The phone's haptics on a board (docs/PRODUCT.md, iOS); none when left out. */
  readonly haptics?: Haptics;
}

/** A selector that finds a control again after its screen is drawn anew, or null. */
function focusSelector(element: Element | null, root: HTMLElement): string | null {
  if (!(element instanceof HTMLElement) || !root.contains(element)) return null;
  if (element.dataset.day !== undefined) return `[data-day="${element.dataset.day}"]`;
  // Only plain class names, so the selector can never make querySelector throw.
  const names = [...element.classList];
  if (names.length === 0 || !names.every((name) => /^[a-z][\w-]*$/i.test(name))) return null;
  return names.map((name) => `.${name}`).join('');
}

/** One screen at a time; each can be torn down. */
interface Screen {
  destroy(): void;
}

/**
 * The app shell: shows the screen an address names, and keeps the player's
 * progress and daily results. Only it talks to the stores.
 */
export class App {
  private readonly root: HTMLElement;
  private readonly options: AppOptions;
  private readonly progress: ProgressStore;
  private readonly daily: DailyStore;
  private readonly league: LeagueProvider;
  private readonly events: EventStore;
  private screen: Screen | null = null;
  private play: PlayScreen | null = null;
  /** What is showing, for `refresh`. */
  private route: Route = { screen: 'home' };

  constructor(root: HTMLElement, options: AppOptions) {
    this.root = root;
    this.options = options;
    this.progress = new ProgressStore(options.store);
    this.daily = new DailyStore(options.store);
    this.league = new SimulatedLeagueProvider(options.store, t('league.you'));
    this.events = new EventStore(options.store);
  }

  /** Today's date key on the device's clock. */
  private today(): DateKey {
    return localDateKey(this.options.clock());
  }

  /** Shows what an address names: a puzzle, the daily calendar, or the home screen. */
  show(search: string): void {
    const route = parseRoute(search);
    switch (route.screen) {
      case 'home':
        this.showHome();
        return;
      case 'calendar':
        this.showCalendar(route.month);
        return;
      case 'league':
        this.showLeague();
        return;
      case 'play':
        this.showPuzzle(route.ref);
        return;
    }
  }

  /**
   * Draws the home screen, the calendar or the league again from storage, when
   * one is showing: after the browser restores the page from its back-forward cache,
   * or when another tab has saved progress. A board in play is left as it is.
   */
  refresh(): void {
    if (this.route.screen === 'play') return;
    // The screen is drawn anew: keep focus on the same control, as far as it still exists.
    const focused = focusSelector(this.root.ownerDocument.activeElement, this.root);
    if (this.route.screen === 'home') this.showHome();
    else if (this.route.screen === 'league') this.showLeague();
    else this.showCalendar(this.route.month);
    if (focused !== null) this.root.querySelector<HTMLElement>(focused)?.focus();
  }

  /** Tears down the screen showing and puts the one `make` builds in its place. */
  private swap<S extends Screen>(make: () => S): S {
    this.screen?.destroy();
    this.play = null;
    const screen = make();
    this.screen = screen;
    return screen;
  }

  private showHome(): void {
    this.route = { screen: 'home' };
    const now = this.options.clock();
    const home = this.swap(
      () =>
        new HomeScreen(this.root, {
          theme: this.options.theme,
          progress: this.progress.progress,
          league: this.league.view(now),
          event: this.homeEvent(),
          finishedDays: this.daily.finished(),
          today: this.today(),
          pickerHref: this.options.pickerHref,
          reducedMotion: this.options.reducedMotion,
        }),
    );
    // The first screen of a new day says how the last day played ended. Shown is
    // seen, here as in the league: it never shows twice.
    const summary = this.league.summary(now);
    if (summary !== null) {
      this.league.dismissSummary();
      home.showSheet({
        kind: 'summary',
        title: t('league.summaryTitle'),
        body: summaryText(summary),
        action: t('league.continue'),
        onAction: () => undefined,
        secondary: { label: t('league.see'), href: LEAGUE_HREF },
      });
    }
  }

  private showLeague(): void {
    this.route = { screen: 'league' };
    this.swap(
      () =>
        new LeagueScreen(this.root, {
          theme: this.options.theme,
          league: this.league,
          clock: this.options.clock,
          homeHref: HOME_HREF,
        }),
    );
  }

  private showCalendar(month: MonthKey | null): void {
    const today = this.today();
    const shown = clampMonth(month ?? monthOf(today), today);
    // A month outside the calendar shows the nearest one, and the address says so.
    if (month !== null && month !== shown) {
      this.options.replaceUrl(routeSearch({ screen: 'calendar', month: shown }));
    }
    this.route = { screen: 'calendar', month: month === null ? null : shown };
    this.swap(
      () =>
        new CalendarScreen(this.root, {
          theme: this.options.theme,
          today,
          month: shown,
          finished: this.daily.finished(),
          homeHref: HOME_HREF,
          // Moving between months replaces the address: Back still leads home.
          onMonth: (next) => {
            this.route = { screen: 'calendar', month: next };
            this.options.replaceUrl(routeSearch(this.route));
          },
        }),
    );
  }

  /** The event the home screen shows, with the player's progress in it. */
  private homeEvent(): HomeEvent | null {
    const today = this.today();
    const event = eventOn(today);
    if (event === null) return null;
    return {
      event,
      state: eventState(event, today),
      progress: this.events.progress(event),
      daysLeft: daysLeft(event, today),
    };
  }

  /**
   * Where an event board's address leads: the board itself while the event runs
   * and the board is open (won before, or the next one), the next board when it
   * names one further on, or nothing (the home screen) when the event is not running.
   */
  private openEventBoard(ref: Extract<PuzzleRef, { kind: 'event' }>): PuzzleRef | null {
    const event = findEvent(ref.eventId)!;
    if (!this.eventRuns(event.id)) return null;
    const { next } = this.events.progress(event);
    if (next === null || ref.board <= next) return ref;
    return { kind: 'event', eventId: event.id, board: next };
  }

  private showPuzzle(ref: PuzzleRef): void {
    if (ref.kind === 'event') {
      const open = this.openEventBoard(ref);
      if (open === null) {
        this.options.replaceUrl(routeSearch({ screen: 'home' }));
        this.showHome();
        return;
      }
      if (open !== ref) {
        this.options.replaceUrl(routeSearch({ screen: 'play', ref: open }));
        ref = open;
      }
    }
    // Future days, and days before the first daily, cannot be opened (docs/PRODUCT.md).
    if (ref.kind === 'daily' && !isPlayableDay(ref.dateKey, this.today())) {
      const month = clampMonth(monthOf(ref.dateKey), this.today());
      this.options.replaceUrl(routeSearch({ screen: 'calendar', month }));
      this.showCalendar(month);
      return;
    }
    this.route = { screen: 'play', ref };
    if (this.play === null) {
      const play = this.swap(
        () =>
          new PlayScreen(this.root, {
            theme: this.options.theme,
            now: this.options.now,
            reducedMotion: this.options.reducedMotion,
            homeHref: HOME_HREF,
            navigate: (next) => {
              this.options.pushUrl(routeSearch({ screen: 'play', ref: next }));
              this.showPuzzle(next);
            },
            record: (result) => this.record(result),
            exitFor: (puzzle) => this.exitFor(puzzle),
            next: (puzzle) => this.nextFor(puzzle),
            ...(this.options.ads !== undefined ? { ads: this.options.ads } : {}),
            ...(this.options.haptics !== undefined ? { haptics: this.options.haptics } : {}),
          }),
      );
      this.play = play;
    }
    this.play.open(ref);
  }

  /** After a win: the next level, or an event's next board while the event runs. */
  private nextFor(ref: PuzzleRef): NextBoard | null {
    if (ref.kind === 'level') {
      return { ref: { kind: 'level', level: ref.level + 1 }, label: t('won.next') };
    }
    if (ref.kind !== 'event') return null;
    const event = findEvent(ref.eventId)!;
    if (ref.board >= event.boards.length || !this.eventRuns(event.id)) {
      return null;
    }
    return {
      ref: { kind: 'event', eventId: event.id, board: ref.board + 1 },
      label: t('won.nextBoard'),
    };
  }

  /** A daily leads back to its month in the calendar; anything else to the home screen. */
  private exitFor(ref: PuzzleRef): Exit {
    if (ref.kind === 'daily') {
      return {
        href: calendarHref(monthOf(ref.dateKey)),
        link: t('nav.calendar'),
        back: t('nav.backCalendar'),
      };
    }
    return { href: HOME_HREF, link: t('nav.home'), back: t('nav.back') };
  }

  /**
   * Levels move the path and the streak; a replay of a level already won only
   * keeps its best time. A won daily earns its star; a lost one is not stored.
   * An event board won while the event runs counts for the event, and the last
   * one earns its badge. Every board won also earns league points, event boards
   * with the bonus while the event runs.
   */
  private record(result: BoardResult): ResultNote | undefined {
    const note = this.recordPuzzle(result);
    if (result.outcome !== 'won') return note;
    const { ref } = result;
    const board = {
      key: puzzleKey(ref),
      tier: result.tier,
      cellCount: result.cellCount,
      timeSeconds: result.elapsedMs / 1000,
      chancesLost: result.chancesLost,
      event: ref.kind === 'event' && this.eventRuns(ref.eventId),
    };
    // Every board won counts for the league, once a day (docs/PRODUCT.md, Daily league).
    const award = this.league.record(board, this.options.clock());
    if (award !== null) return { ...note, score: award.points, league: award };
    // Already counted today: the score screen still shows what the board is worth.
    const score = scoreBoard({
      tier: board.tier,
      cellCount: board.cellCount,
      timeSeconds: board.timeSeconds,
      mistakes: board.chancesLost,
      event: board.event,
    });
    return { ...note, score };
  }

  private eventRuns(eventId: string): boolean {
    return eventState(findEvent(eventId)!, this.today()) === 'running';
  }

  private recordPuzzle(result: BoardResult): ResultNote | undefined {
    const { ref } = result;
    if (ref.kind === 'event') {
      // A board opened on the last day and won after midnight no longer counts (docs/PRODUCT.md).
      if (result.outcome === 'lost' || !this.eventRuns(ref.eventId)) return undefined;
      const event = findEvent(ref.eventId)!;
      const win = this.events.recordWin(event, ref.board);
      if (!win.first) return undefined;
      return {
        event: {
          board: ref.board,
          total: event.boards.length,
          ...(win.badge ? { badge: t(event.badge) } : {}),
        },
      };
    }
    if (ref.kind === 'daily') {
      if (result.outcome === 'lost') return undefined;
      const win = this.daily.recordWin(ref.dateKey, result.elapsedMs, this.today());
      if (!win.replay) return { star: win.monthComplete ? 'month' : 'day' };
      return { bestMs: win.bestMs, newBest: win.newBest };
    }
    if (ref.kind !== 'level') return undefined;
    if (result.outcome === 'lost') {
      this.progress.recordLoss(ref.level);
      return undefined;
    }
    const win = this.progress.recordWin({
      level: ref.level,
      elapsedMs: result.elapsedMs,
      firstTry: result.firstTry,
    });
    // A first win has no earlier best to compare with: the sheet shows only its time.
    if (!win.replay) return { streak: win.streak };
    return { bestMs: win.bestMs, newBest: win.newBest };
  }
}
