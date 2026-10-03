import { boardBounds } from '../board/geometry.ts';
import { BoardRenderer } from '../board/renderer.ts';
import { createViewport, transformOf } from '../board/viewport.ts';
import { levelStrip } from '../levelStrip.ts';
import type { Progress } from '../persistence/progress.ts';
import { loadPuzzle, tierLabel } from '../puzzles.ts';
import type { PuzzleRef } from '../route.ts';
import { puzzleHref } from '../route.ts';
import { formatDayShort, t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';

export interface HomeScreenOptions {
  readonly theme: Theme;
  readonly progress: Progress;
  /** Today's date key in local time, for the Daily card. */
  readonly today: string;
  readonly pickerHref: string;
  readonly reducedMotion: () => boolean;
}

/** The event board on the home screen until T6 brings events. */
export const EVENT_REF: PuzzleRef = { kind: 'drawing', drawingId: 'butterfly', tier: 'hard' };

const THUMB_SIZE = 104;

/**
 * The home screen (docs/DESIGN.md, Home): the wordmark, the streak, the Levels
 * card with the level strip and Play, and a card per other mode. Daily and the
 * event open their boards; the league card waits for T5.
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
        el(
          doc,
          'a',
          { class: 'round-button menu', href: options.pickerHref, 'aria-label': t('home.menu') },
          [iconSpan(doc, theme.icons.menu, 'icon')],
        ),
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

    const daily = el(
      doc,
      'a',
      {
        class: 'card mode-card daily',
        href: puzzleHref({ kind: 'daily', dateKey: options.today }),
      },
      [
        el(doc, 'span', { class: 'card-label' }, [t('home.daily')]),
        el(doc, 'span', { class: 'card-title small' }, [formatDayShort(options.today)]),
        el(doc, 'span', { class: 'card-note' }, [t('home.dailyNote')]),
      ],
    );
    // Not a link until T5: drawn flat, unlike the cards that open something.
    const league = el(doc, 'div', { class: 'card mode-card league', 'data-soon': 'true' }, [
      el(doc, 'span', { class: 'card-label' }, [t('home.league')]),
      el(doc, 'span', { class: 'card-title small' }, [t('home.leagueTitle')]),
      el(doc, 'span', { class: 'card-note' }, [t('home.leagueNote')]),
    ]);

    const event = loadPuzzle(EVENT_REF);
    const thumb = el(doc, 'div', { class: 'event-thumb', 'aria-hidden': 'true' });
    const renderer = new BoardRenderer(thumb, theme, options.reducedMotion);
    renderer.render(event.puzzle);
    const view = createViewport(
      THUMB_SIZE,
      THUMB_SIZE,
      boardBounds(event.puzzle.width, event.puzzle.height, theme.board.margin),
    );
    renderer.setStageSize(THUMB_SIZE, THUMB_SIZE);
    renderer.setTransform(transformOf(view));
    const eventCard = el(doc, 'a', { class: 'card event-card', href: puzzleHref(EVENT_REF) }, [
      thumb,
      el(doc, 'span', { class: 'event-text' }, [
        el(doc, 'span', { class: 'card-label' }, [t('home.event')]),
        el(doc, 'span', { class: 'card-title small' }, [event.title]),
        el(doc, 'span', { class: 'card-note' }, [t('home.eventNote')]),
      ]),
    ]);

    this.element = el(doc, 'main', { class: 'home' }, [
      top,
      levels,
      el(doc, 'div', { class: 'card-row' }, [daily, league]),
      eventCard,
    ]);
    root.replaceChildren(this.element);
    doc.title = t('app.name');
  }

  destroy(): void {
    this.element.remove();
  }
}
