import { LEAGUES } from '@arrows/engine';
import type { DaySummary, LeagueProvider, LeagueRow, LeagueView } from '../league/provider.ts';
import { formatCountdown, formatDayShort, ordinal, t, tn } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';
import { Overlay } from '../ui/overlay.ts';

export interface LeagueScreenOptions {
  readonly theme: Theme;
  readonly league: LeagueProvider;
  /** The wall clock, for the day, the time of day and the countdown. */
  readonly clock: () => Date;
  readonly homeHref: string;
}

/** How often the table and the countdown move while the screen is open. */
export const LEAGUE_TICK_MS = 30_000;

/** The sentence a day's summary sheet says (docs/PRODUCT.md, Daily league). */
export function summaryText(summary: DaySummary): string {
  const league = LEAGUES[summary.league]!;
  const params = {
    rank: ordinal(summary.rank),
    league,
    day: formatDayShort(summary.day),
    points: tn('league.points', summary.points),
  };
  switch (summary.outcome) {
    case 'promoted':
      return t('league.summary.promoted', { ...params, next: LEAGUES[summary.league + 1]! });
    case 'relegated':
      return t('league.summary.relegated', { ...params, next: LEAGUES[summary.league - 1]! });
    case 'stayed':
      return t('league.summary.stayed', params);
  }
}

/** The rules paragraph under the league name: who moves where tonight. */
function rulesText(view: LeagueView): string {
  const moves =
    view.up !== null && view.down !== null
      ? t('league.rules.both', { up: view.up, down: view.down })
      : view.up !== null
        ? t('league.rules.bottom', { up: view.up, league: view.name })
        : t('league.rules.top', { down: view.down ?? '', league: view.name });
  return `${moves} ${t('league.characters')}`;
}

/**
 * Which of the theme's avatar colours a character wears: from its name, so the
 * same character keeps its colour and neighbours in the table rarely match.
 */
export function avatarColour(name: string, colours: number): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % colours;
}

/** Two letters for a round avatar: `Wonderful Butterfly` is `WB`. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * The daily league (docs/DESIGN.md, Daily league): the league's name and the
 * countdown to midnight, the rules, and the table of 30 with the player's row
 * raised and the dividers where the top ten and the bottom ten move. The table
 * moves while the screen is open; the day's summary shows here once.
 */
export class LeagueScreen {
  readonly element: HTMLElement;
  private readonly options: LeagueScreenOptions;
  private readonly name: HTMLHeadingElement;
  private readonly reset: HTMLParagraphElement;
  private readonly rules: HTMLParagraphElement;
  private readonly join: HTMLParagraphElement;
  private readonly table: HTMLOListElement;
  private readonly overlay: Overlay;
  private readonly page: HTMLElement[];
  private readonly disposers: (() => void)[] = [];
  private scrolled = false;

  constructor(root: HTMLElement, options: LeagueScreenOptions) {
    this.options = options;
    const doc = root.ownerDocument;
    const { theme } = options;

    const info = el(
      doc,
      'button',
      { class: 'round-button info', type: 'button', 'aria-label': t('league.info') },
      [iconSpan(doc, theme.icons.info, 'icon')],
    );
    const top = el(doc, 'header', { class: 'topbar league-top' }, [
      el(
        doc,
        'a',
        { class: 'round-button back', href: options.homeHref, 'aria-label': t('nav.back') },
        [iconSpan(doc, theme.icons.back, 'icon')],
      ),
      el(doc, 'div', { class: 'title' }, [el(doc, 'h1', {}, [t('league.title')])]),
      info,
    ]);
    this.name = el(doc, 'h2', { class: 'league-name' });
    this.reset = el(doc, 'p', { class: 'league-reset' });
    this.rules = el(doc, 'p', { class: 'league-rules' });
    this.join = el(doc, 'p', { class: 'league-join' }, [t('league.join')]);
    this.table = el(doc, 'ol', { class: 'league-table' });
    this.overlay = new Overlay(doc, { floating: true });
    const head = el(doc, 'div', { class: 'league-head' }, [this.name, this.reset]);
    this.page = [top, head, this.rules, this.join, this.table];
    // Not `league`: the home screen's League card has that class.
    this.element = el(doc, 'main', { class: 'league-screen' }, [
      ...this.page,
      this.overlay.element,
    ]);
    root.replaceChildren(this.element);
    doc.title = `${t('league.title')} · ${t('app.name')}`;

    const showRules = (): void =>
      this.showSheet({
        kind: 'rules',
        title: t('league.howTitle'),
        body: t('league.howBody'),
        action: t('league.gotIt'),
        onAction: () => this.hideSheet(info),
      });
    info.addEventListener('click', showRules);
    this.disposers.push(() => info.removeEventListener('click', showRules));
    const timer = globalThis.setInterval(() => this.render(), LEAGUE_TICK_MS);
    this.disposers.push(() => globalThis.clearInterval(timer));
    this.render();
  }

  destroy(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    this.element.remove();
  }

  /** Draws the table as it is now; at midnight this settles the day and shows its summary. */
  private render(): void {
    const now = this.options.clock();
    const view = this.options.league.view(now);
    const doc = this.element.ownerDocument;
    this.element.dataset.league = view.name;
    this.element.dataset.day = view.day;
    this.name.textContent = view.name;
    this.reset.textContent = t('league.resets', { time: formatCountdown(view.msUntilReset) });
    this.rules.textContent = rulesText(view);
    this.join.hidden = view.joined;
    this.table.setAttribute('aria-label', t('league.table', { league: view.name }));

    const items: HTMLElement[] = [];
    for (const row of view.rows) {
      const previous = view.rows[row.rank - 2];
      // After the last rank that moves up, and before the first that moves down.
      if (previous?.zone === 'up' && row.zone !== 'up') {
        items.push(this.divider(doc, t('league.aboveUp'), 'up'));
      }
      if (row.zone === 'down' && previous?.zone !== 'down') {
        items.push(this.divider(doc, t('league.belowDown'), 'down'));
      }
      items.push(this.row(doc, row, view.joined));
    }
    this.table.replaceChildren(...items);

    // The player's row in sight on the first draw; later draws keep the scroll.
    if (!this.scrolled) {
      this.scrolled = true;
      const mine = this.table.querySelector<HTMLElement>('[data-kind="player"]');
      // jsdom, where the unit tests run, has no scrollIntoView.
      if (mine !== null && 'scrollIntoView' in mine) mine.scrollIntoView({ block: 'center' });
    }

    // Shown is seen, here as on the home screen: it never shows twice.
    const summary = this.options.league.summary(now);
    if (summary !== null && !this.overlay.visible) {
      this.options.league.dismissSummary();
      this.showSheet({
        kind: 'summary',
        title: t('league.summaryTitle'),
        body: summaryText(summary),
        action: t('league.continue'),
        onAction: () => this.hideSheet(),
      });
    }
  }

  private divider(doc: Document, label: string, zone: 'up' | 'down'): HTMLElement {
    // The rows say where they move; the dividers are for sight.
    return el(doc, 'li', { class: 'league-divider', 'data-zone': zone, 'aria-hidden': 'true' }, [
      label,
    ]);
  }

  private row(doc: Document, row: LeagueRow, joined: boolean): HTMLElement {
    const player = row.kind === 'player';
    // Before a board is won today the player has no place in the table: no rank, no move.
    const ranked = !player || joined;
    const said = ranked
      ? [
          ordinal(row.rank),
          row.name,
          ...(player ? [] : [t('league.character')]),
          tn('league.points', row.score),
          ...(row.zone === 'up' ? [t('league.movesUp')] : []),
          ...(row.zone === 'down' ? [t('league.movesDown')] : []),
        ].join(', ')
      : `${row.name}, ${t('league.notJoined')}`;
    const avatar = el(doc, 'span', { class: 'avatar', 'aria-hidden': 'true' }, [
      player ? initials(t('league.you')) : initials(row.name),
    ]);
    if (!player) {
      const colour = avatarColour(row.name, this.options.theme.avatars.length);
      avatar.style.setProperty('--avatar', `var(--avatar-${colour})`);
    }
    return el(
      doc,
      'li',
      {
        class: 'league-row',
        'data-kind': row.kind,
        'data-rank': String(row.rank),
        'data-zone': row.zone,
        ...(player ? { 'aria-current': 'true' } : {}),
      },
      [
        el(doc, 'span', { class: 'sr-only' }, [said]),
        el(doc, 'span', { class: 'rank', 'aria-hidden': 'true' }, [
          ranked ? String(row.rank) : '–',
        ]),
        avatar,
        // The name with its tag under it: the name keeps the width on a small phone.
        el(doc, 'span', { class: 'row-who', 'aria-hidden': 'true' }, [
          el(doc, 'span', { class: 'row-name' }, [player ? t('league.you') : row.name]),
          ...(player ? [] : [el(doc, 'span', { class: 'tag' }, [t('league.character')])]),
        ]),
        el(doc, 'span', { class: 'score', 'aria-hidden': 'true' }, [String(row.score)]),
      ],
    );
  }

  private showSheet(content: Parameters<Overlay['show']>[0]): void {
    for (const part of this.page) part.toggleAttribute('inert', true);
    this.overlay.show(content);
  }

  /** Closes the sheet; focus goes back to `returnTo` or the back link. */
  private hideSheet(returnTo?: HTMLElement): void {
    this.overlay.hide();
    for (const part of this.page) part.toggleAttribute('inert', false);
    (returnTo ?? this.element.querySelector<HTMLElement>('.back'))?.focus();
  }
}
