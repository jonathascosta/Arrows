import { dailySpec } from '@arrows/engine';
import type { DateKey, MonthKey } from '../daily/days.ts';
import { isPlayableDay } from '../daily/days.ts';
import { monthModel, trophies } from '../daily/month.ts';
import type { DayCell } from '../daily/month.ts';
import { tierLabel } from '../puzzles.ts';
import { puzzleHref } from '../route.ts';
import { formatDayLong, formatMonth, formatMonthShort, t, weekdayNames } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';

export interface CalendarScreenOptions {
  readonly theme: Theme;
  readonly today: DateKey;
  /** The month to show first, already within the calendar. */
  readonly month: MonthKey;
  /** The days won. */
  readonly finished: ReadonlySet<DateKey>;
  readonly homeHref: string;
  /** Called after the screen moved to another month, to keep the address in step. */
  readonly onMonth: (month: MonthKey) => void;
}

/**
 * The daily challenge calendar (docs/DESIGN.md, Daily challenge): a month in
 * weeks from Monday, with a star on every day won, today outlined and the days
 * ahead locked; the trophies of earlier months; and Play today.
 */
export class CalendarScreen {
  readonly element: HTMLElement;
  private readonly options: CalendarScreenOptions;
  private readonly monthCard: HTMLElement;
  /** Says the new month when the month buttons move, since focus stays on the button. */
  private readonly status: HTMLElement;
  /** Listeners of the month shown, dropped when it changes. */
  private readonly disposers: (() => void)[] = [];

  constructor(root: HTMLElement, options: CalendarScreenOptions) {
    this.options = options;
    const doc = root.ownerDocument;
    const { theme, today, finished } = options;

    const top = el(doc, 'header', { class: 'topbar calendar-top' }, [
      el(
        doc,
        'a',
        { class: 'round-button back', href: options.homeHref, 'aria-label': t('nav.back') },
        [iconSpan(doc, theme.icons.back, 'icon')],
      ),
      el(doc, 'div', { class: 'title' }, [el(doc, 'h1', {}, [t('calendar.title')])]),
    ]);
    this.monthCard = el(doc, 'section', {
      class: 'card month-card',
      'aria-labelledby': 'month-title',
    });
    this.status = el(doc, 'p', { class: 'sr-only', 'aria-live': 'polite' });
    this.element = el(doc, 'main', { class: 'calendar' }, [
      top,
      this.monthCard,
      this.trophies(doc, theme, today, finished),
      // A clock set before the first daily has no today to play.
      ...(isPlayableDay(today, today) ? [this.playToday(doc, today)] : []),
      this.status,
    ]);
    this.showMonth(options.month);
    root.replaceChildren(this.element);
    doc.title = `${t('calendar.title')} · ${t('app.name')}`;
  }

  destroy(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    this.element.remove();
  }

  /** Draws a month; `focus` names the month button to keep focus on after a move. */
  private showMonth(month: MonthKey, focus?: 'previous' | 'next'): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    const doc = this.element.ownerDocument;
    const { theme, today, finished } = this.options;
    const model = monthModel(month, today, finished);
    this.element.dataset.month = model.month;

    const move = (target: MonthKey, from: 'previous' | 'next'): void => {
      this.showMonth(target, from);
      this.options.onMonth(target);
    };
    const button = (
      target: MonthKey | null,
      from: 'previous' | 'next',
      label: string,
    ): HTMLButtonElement => {
      const element = el(
        doc,
        'button',
        { class: `round-button ${from}`, type: 'button', 'aria-label': label },
        [iconSpan(doc, theme.icons[from], 'icon')],
      );
      if (target === null) element.disabled = true;
      else {
        const handler = (): void => move(target, from);
        element.addEventListener('click', handler);
        this.disposers.push(() => element.removeEventListener('click', handler));
      }
      return element;
    };
    const previous = button(model.previous, 'previous', t('calendar.previous'));
    const next = button(model.next, 'next', t('calendar.next'));
    const header = el(doc, 'div', { class: 'month-head' }, [
      previous,
      el(doc, 'div', { class: 'month-title' }, [
        el(doc, 'h2', { id: 'month-title' }, [formatMonth(model.month)]),
        el(doc, 'p', { class: 'month-stars' }, [
          t('calendar.stars', { n: model.stars, total: model.total }),
        ]),
      ]),
      next,
    ]);

    // The day labels name the weekday, so the heads are for sight only.
    const heads = el(
      doc,
      'div',
      { class: 'week-heads', 'aria-hidden': 'true' },
      weekdayNames().map((name) => el(doc, 'span', {}, [name.narrow])),
    );
    const blanks = Array.from({ length: model.leadingBlanks }, () =>
      el(doc, 'span', { class: 'day blank', 'aria-hidden': 'true' }),
    );
    const grid = el(
      doc,
      'div',
      {
        class: 'month-days',
        role: 'group',
        'aria-label': t('calendar.days', { month: formatMonth(model.month) }),
      },
      [...blanks, ...model.days.map((cell) => this.day(doc, theme, cell))],
    );
    this.monthCard.replaceChildren(header, heads, grid);

    // The pressed button may have just become disabled at either end: then the other one.
    if (focus !== undefined) {
      this.status.textContent = t('calendar.moved', {
        month: formatMonth(model.month),
        n: model.stars,
        total: model.total,
      });
      const pressed = focus === 'previous' ? previous : next;
      (pressed.disabled ? (focus === 'previous' ? next : previous) : pressed).focus();
    }
  }

  private trophies(
    doc: Document,
    theme: Theme,
    today: DateKey,
    finished: ReadonlySet<DateKey>,
  ): HTMLElement {
    const year = Number(today.slice(0, 4));
    const cards = trophies(today, finished).map((trophy) => {
      const month = el(doc, 'span', { class: 'trophy-month', 'aria-hidden': 'true' }, [
        formatMonthShort(trophy.month, year),
      ]);
      // Screen readers read the hidden sentence; the card's short text is for sight only.
      const label = trophy.complete
        ? t('calendar.trophy', { month: formatMonth(trophy.month) })
        : t('calendar.missedLabel', {
            month: formatMonth(trophy.month),
            n: trophy.stars,
            total: trophy.total,
          });
      const said = el(doc, 'span', { class: 'sr-only' }, [label]);
      if (trophy.complete) {
        return el(doc, 'li', { class: 'trophy complete' }, [
          said,
          iconSpan(doc, theme.icons.trophy, 'icon'),
          month,
        ]);
      }
      return el(doc, 'li', { class: 'trophy missed' }, [
        said,
        el(doc, 'span', { class: 'trophy-count', 'aria-hidden': 'true' }, [
          t('calendar.missed', { n: trophy.stars, total: trophy.total }),
        ]),
        month,
      ]);
    });
    return el(doc, 'section', { class: 'trophies', 'aria-labelledby': 'trophies-title' }, [
      el(doc, 'h2', { class: 'section-title', id: 'trophies-title' }, [t('calendar.trophies')]),
      cards.length > 0
        ? el(doc, 'ul', { class: 'trophy-row' }, cards)
        : el(doc, 'p', { class: 'card-note' }, [t('calendar.noTrophies')]),
    ]);
  }

  private playToday(doc: Document, today: DateKey): HTMLElement {
    const spec = dailySpec(today);
    return el(doc, 'div', { class: 'calendar-play' }, [
      el(
        doc,
        'a',
        {
          class: 'button primary play-today',
          href: puzzleHref({ kind: 'daily', dateKey: today }),
          'aria-describedby': 'today-board',
        },
        [t('calendar.play')],
      ),
      el(doc, 'p', { class: 'board-note', id: 'today-board' }, [
        t('calendar.board', {
          kind: spec.weekend ? t('calendar.weekend') : t('calendar.weekday'),
          tier: tierLabel(spec.tier),
          width: spec.width,
          height: spec.height,
        }),
      ]),
    ]);
  }

  /** A day: a link when it can be opened, plain text when locked. */
  private day(doc: Document, theme: Theme, cell: DayCell): HTMLElement {
    const label = [
      formatDayLong(cell.dateKey),
      ...(cell.today ? [t('calendar.today')] : []),
      ...(cell.done ? [t('calendar.done')] : []),
      ...(cell.playable ? [] : [t('calendar.locked')]),
    ].join(', ');
    const state = cell.done ? 'done' : cell.playable ? 'open' : 'locked';
    const content = [
      el(doc, 'span', { class: 'sr-only' }, [label]),
      el(doc, 'span', { class: 'day-number', 'aria-hidden': 'true' }, [String(cell.day)]),
      ...(cell.done ? [iconSpan(doc, theme.icons.star, 'icon star')] : []),
    ];
    const attributes: Record<string, string> = {
      class: 'day',
      'data-day': cell.dateKey,
      'data-state': state,
    };
    if (cell.today) {
      attributes['data-today'] = 'true';
      attributes['aria-current'] = 'date';
    }
    if (!cell.playable) return el(doc, 'span', attributes, content);
    return el(
      doc,
      'a',
      { ...attributes, href: puzzleHref({ kind: 'daily', dateKey: cell.dateKey }) },
      content,
    );
  }
}
