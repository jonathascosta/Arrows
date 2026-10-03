import { boardBounds } from '../board/geometry.ts';
import type { DateKey } from '../daily/days.ts';
import { monthOf } from '../daily/days.ts';
import { monthModel } from '../daily/month.ts';
import { BoardRenderer } from '../board/renderer.ts';
import { createViewport, transformOf } from '../board/viewport.ts';
import { levelStrip } from '../levelStrip.ts';
import type { Progress } from '../persistence/progress.ts';
import { loadPuzzle, tierLabel } from '../puzzles.ts';
import type { EventState, GameEvent } from '../events/catalog.ts';
import type { EventProgress } from '../persistence/events.ts';
import type { PuzzleRef } from '../route.ts';
import type { LeagueView } from '../league/provider.ts';
import type { CueSettings } from '../platform/cues.ts';
import { calendarHref, LEAGUE_HREF, puzzleHref } from '../route.ts';
import {
  capitalize,
  formatCountdown,
  formatDayShort,
  leagueLabel,
  ordinal,
  t,
} from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';
import { Overlay } from '../ui/overlay.ts';
import { SettingsSheet } from '../ui/settings.ts';
import type { OverlayContent } from '../ui/overlay.ts';

export interface HomeScreenOptions {
  readonly theme: Theme;
  readonly progress: Progress;
  /** The league now, for the League card. */
  readonly league: LeagueView;
  /** The event the home screen shows, with the player's progress; null before the first. */
  readonly event: HomeEvent | null;
  /** The daily challenge days won, for the Daily card's stars. */
  readonly finishedDays: ReadonlySet<DateKey>;
  /** Today's date key in local time, for the Daily card. */
  readonly today: DateKey;
  readonly pickerHref: string;
  readonly reducedMotion: () => boolean;
  /** The player's Settings, which the menu opens. */
  readonly settings: {
    readonly read: () => CueSettings;
    readonly change: (change: Partial<CueSettings>) => void;
    readonly hapticsAvailable: boolean;
  };
}

/** The event on the home screen and how far the player got in it. */
export interface HomeEvent {
  readonly event: GameEvent;
  readonly state: EventState;
  readonly progress: EventProgress;
  readonly daysLeft: number;
}

const THUMB_SIZE = 104;

/**
 * The home screen (docs/DESIGN.md, Home): the wordmark, the streak, the Levels
 * card with the level strip and Play, and a card per other mode.
 */
export class HomeScreen {
  readonly element: HTMLElement;

  constructor(root: HTMLElement, options: HomeScreenOptions) {
    const doc = root.ownerDocument;
    const { theme, progress } = options;
    const current = progress.currentLevel;
    const strip = levelStrip(current);
    const tier = strip.find((item) => item.state === 'current')!.tier;

    const top = el(doc, 'header', { class: 'home-top' }, [
      el(doc, 'h1', { class: 'wordmark' }, [t('app.name')]),
      el(doc, 'div', { class: 'home-actions' }, [
        // Plain text for screen readers: an aria-label on an element with no role is not read.
        el(doc, 'p', { class: 'chip streak' }, [
          iconSpan(doc, theme.icons.streak, 'icon'),
          el(doc, 'span', { class: 'sr-only' }, [t('home.streakLabel', { n: progress.streak })]),
          el(doc, 'span', { 'aria-hidden': 'true' }, [t('home.streak', { n: progress.streak })]),
        ]),
        this.menuButton(doc, options),
      ]),
    ]);

    const levels = el(
      doc,
      'section',
      { class: 'card levels-card', 'aria-labelledby': 'levels-title' },
      [
        el(doc, 'div', { class: 'card-head' }, [
          el(doc, 'span', { class: 'card-label' }, [t('home.levels')]),
          el(doc, 'span', { class: 'tier-badge', 'data-tier': tier }, [tierLabel(tier)]),
        ]),
        el(doc, 'h2', { class: 'card-title', id: 'levels-title' }, [
          t('title.level', { n: current }),
        ]),
        el(
          doc,
          'ol',
          { class: 'level-strip', 'aria-label': t('home.path') },
          strip.map((item) =>
            el(
              doc,
              'li',
              {
                class: 'strip-item',
                'data-state': item.state,
                'data-tier': item.tier,
                'aria-label': t(
                  item.state === 'done'
                    ? 'home.done'
                    : item.state === 'current'
                      ? 'home.current'
                      : 'home.ahead',
                  { n: item.level },
                ),
              },
              [el(doc, 'span', { 'aria-hidden': 'true' }, [String(item.level)])],
            ),
          ),
        ),
        el(
          doc,
          'a',
          {
            class: 'button primary play-button',
            href: puzzleHref({ kind: 'level', level: current }),
          },
          [t('home.play')],
        ),
      ],
    );

    const month = monthModel(monthOf(options.today), options.today, options.finishedDays);
    const stars = { n: month.stars, total: month.total };
    const daily = el(doc, 'a', { class: 'card mode-card daily', href: calendarHref() }, [
      el(doc, 'span', { class: 'card-label' }, [t('home.daily')]),
      el(doc, 'span', { class: 'card-title small' }, [capitalize(formatDayShort(options.today))]),
      el(doc, 'span', { class: 'card-note daily-stars' }, [
        iconSpan(doc, theme.icons.star, 'icon star'),
        el(doc, 'span', { class: 'sr-only' }, [t('home.dailyStarsLabel', stars)]),
        el(doc, 'span', { 'aria-hidden': 'true' }, [t('home.dailyStars', stars)]),
      ]),
    ]);
    // Not a link until T5: drawn flat, unlike the cards that open something.
    const { league } = options;
    const leagueCard = el(doc, 'a', { class: 'card mode-card league', href: LEAGUE_HREF }, [
      el(doc, 'span', { class: 'card-label' }, [t('home.league')]),
      el(doc, 'span', { class: 'card-title small' }, [
        league.joined
          ? t('home.leagueRank', {
              league: leagueLabel(league.name),
              rank: ordinal(league.player.rank),
            })
          : leagueLabel(league.name),
      ]),
      el(doc, 'span', { class: 'card-note' }, [
        league.joined
          ? t('league.resets', { time: formatCountdown(league.msUntilReset) })
          : t('home.leagueJoin'),
      ]),
    ]);

    const eventCard = options.event === null ? null : this.eventCard(doc, theme, options);
    this.element = el(doc, 'main', { class: 'home' }, [
      top,
      levels,
      el(doc, 'div', { class: 'card-row' }, [daily, leagueCard]),
      ...(eventCard === null ? [] : [eventCard]),
    ]);
    root.replaceChildren(this.element);
    doc.title = t('app.name');
  }

  destroy(): void {
    this.element.remove();
  }

  /**
   * The event card (docs/DESIGN.md, Home): a thumbnail of the next board, the
   * event's name, the drawing, a bar with a segment per board, and the boards
   * won with the days left. It opens the next board while the event runs.
   */
  private eventCard(doc: Document, theme: Theme, options: HomeScreenOptions): HTMLElement {
    const { event, state, progress, daysLeft } = options.event!;
    const board = progress.next ?? progress.total;
    const ref: PuzzleRef = { kind: 'event', eventId: event.id, board };
    const loaded = loadPuzzle(ref);
    const thumb = el(doc, 'div', { class: 'event-thumb', 'aria-hidden': 'true' });
    const renderer = new BoardRenderer(thumb, theme, options.reducedMotion);
    renderer.render(loaded.puzzle);
    const view = createViewport(
      THUMB_SIZE,
      THUMB_SIZE,
      boardBounds(loaded.puzzle.width, loaded.puzzle.height, theme.board.margin),
    );
    renderer.setStageSize(THUMB_SIZE, THUMB_SIZE);
    renderer.setTransform(transformOf(view));

    const boards = t('home.eventBoards', { n: progress.won.length, total: progress.total });
    const when =
      state === 'ended'
        ? t('home.eventEnded', { date: formatDayShort(event.end) })
        : daysLeft === 1
          ? t('home.eventLastDay')
          : t('home.eventDaysLeft', { n: daysLeft });
    const bar = el(
      doc,
      'span',
      { class: 'event-progress', 'aria-hidden': 'true' },
      Array.from({ length: progress.total }, (_, i) =>
        el(doc, 'span', progress.won.includes(i + 1) ? { 'data-done': 'true' } : {}),
      ),
    );
    const title = progress.complete
      ? el(doc, 'span', { class: 'card-title small badge-earned' }, [
          iconSpan(doc, theme.icons.badge, 'icon'),
          t('home.eventBadge'),
        ])
      : el(doc, 'span', { class: 'card-title small' }, [loaded.title]);
    const text = el(doc, 'span', { class: 'event-text' }, [
      el(doc, 'span', { class: 'card-label' }, [t(event.name)]),
      title,
      bar,
      el(doc, 'span', { class: 'card-note' }, [`${boards} · ${when}`]),
    ]);
    // A link only while there is a board to play.
    const open = state === 'running' && progress.next !== null;
    return open
      ? el(doc, 'a', { class: 'card event-card', href: puzzleHref(ref) }, [thumb, text])
      : el(doc, 'div', { class: 'card event-card', 'data-state': state }, [thumb, text]);
  }

  /** The menu button, which opens Settings over the home screen. */
  private menuButton(doc: Document, options: HomeScreenOptions): HTMLButtonElement {
    const button = el(
      doc,
      'button',
      {
        class: 'round-button menu',
        type: 'button',
        'aria-label': t('home.menu'),
        'aria-haspopup': 'dialog',
      },
      [iconSpan(doc, options.theme.icons.menu, 'icon')],
    );
    button.addEventListener('click', () => {
      const page = [...this.element.children];
      const sheet = new SettingsSheet(doc, {
        settings: options.settings.read(),
        hapticsAvailable: options.settings.hapticsAvailable,
        pickerHref: options.pickerHref,
        onChange: options.settings.change,
        onClose: () => {
          sheet.element.remove();
          for (const part of page) part.toggleAttribute('inert', false);
          button.focus();
        },
      });
      for (const part of page) part.toggleAttribute('inert', true);
      this.element.append(sheet.element);
      sheet.focus();
    });
    return button;
  }

  /** A sheet over the home screen, such as the league's summary of the last day played. */
  showSheet(content: OverlayContent): void {
    const doc = this.element.ownerDocument;
    const overlay = new Overlay(doc, { floating: true });
    const page = [...this.element.children];
    for (const part of page) part.toggleAttribute('inert', true);
    this.element.append(overlay.element);
    overlay.show({
      ...content,
      onAction: () => {
        overlay.element.remove();
        for (const part of page) part.toggleAttribute('inert', false);
        this.element.querySelector<HTMLElement>('.play-button')?.focus();
        content.onAction();
      },
    });
  }
}
