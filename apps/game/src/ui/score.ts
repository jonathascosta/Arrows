import type { Tier } from '@arrows/engine';
import { t } from '../strings.ts';
import { el } from './dom.ts';

/** What the score screen shows for one won board. */
export interface ScoreContent {
  /** The line above "Solved": "Level 42 · Medium", in the tier's colour. */
  readonly heading: string;
  readonly tier: Tier;
  /** What the win did: the streak, a daily's star, an event's board or badge. */
  readonly lines: readonly string[];
  readonly time: string;
  /** Next to the time: "best 01:31" on a replay, or "new best". */
  readonly best?: string;
  /** "1 of 3". */
  readonly chancesLost: string;
  /** The board's points; left out when nothing recorded the board. */
  readonly score?: number;
  /** The league line: what the board earned, or that it already counted today. */
  readonly league?: string;
  readonly action: string;
  readonly onAction: () => void;
  readonly secondary: { readonly label: string; readonly href: string };
}

/**
 * The score screen after a won board (docs/DESIGN.md, Win): the tier line,
 * "Solved" and what the win did, a card with the time, the chances lost and
 * the score, the league line, the next board and the way home. It covers the
 * board, which stays behind it until the player moves on.
 */
export class ScoreScreen {
  readonly element: HTMLDivElement;
  private readonly heading: HTMLParagraphElement;
  private readonly lines: HTMLParagraphElement;
  private readonly time: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly chancesLost: HTMLElement;
  private readonly scoreRow: HTMLDivElement;
  private readonly score: HTMLElement;
  private readonly league: HTMLParagraphElement;
  private readonly leagueText: HTMLSpanElement;
  private readonly button: HTMLButtonElement;
  private readonly secondary: HTMLAnchorElement;
  private onAction: (() => void) | null = null;

  constructor(doc: Document) {
    const row = (label: string, value: HTMLElement, className = 'score-row'): HTMLDivElement =>
      el(doc, 'div', { class: className }, [
        el(doc, 'dt', {}, [label]),
        el(doc, 'dd', {}, [value]),
      ]);
    this.heading = el(doc, 'p', { class: 'score-heading' });
    this.lines = el(doc, 'p', { class: 'score-lines', id: 'score-lines' });
    this.time = el(doc, 'span', { class: 'score-time' });
    this.best = el(doc, 'span', { class: 'score-best' });
    this.chancesLost = el(doc, 'span');
    this.score = el(doc, 'span', { class: 'score-total' });
    this.scoreRow = row(t('won.score'), this.score, 'score-row score');
    this.leagueText = el(doc, 'span');
    this.league = el(doc, 'p', { class: 'score-league', id: 'score-league' }, [
      el(doc, 'span', { class: 'score-dot', 'aria-hidden': 'true' }),
      this.leagueText,
    ]);
    this.button = el(doc, 'button', { class: 'button primary', type: 'button' });
    this.button.addEventListener('click', () => this.onAction?.());
    this.secondary = el(doc, 'a', { class: 'text-button' });
    const timeValue = el(doc, 'span', { class: 'score-time-value' }, [this.best, this.time]);
    this.element = el(
      doc,
      'div',
      {
        class: 'score-screen',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'score-title',
        // What the win did, the card's figures and the league line: what a glance takes in.
        'aria-describedby': 'score-lines score-card score-league',
      },
      [
        el(doc, 'div', { class: 'score-column' }, [
          this.heading,
          el(doc, 'h2', { id: 'score-title' }, [t('won.title')]),
          this.lines,
          el(doc, 'dl', { class: 'score-card', id: 'score-card' }, [
            row(t('won.time'), timeValue),
            row(t('won.chancesLost'), this.chancesLost),
            this.scoreRow,
          ]),
          this.league,
          this.button,
          this.secondary,
        ]),
      ],
    );
    this.element.hidden = true;
  }

  show(content: ScoreContent): void {
    this.heading.textContent = content.heading;
    this.heading.dataset.tier = content.tier;
    this.lines.textContent = content.lines.join(' ');
    this.lines.hidden = content.lines.length === 0;
    this.time.textContent = content.time;
    this.best.textContent = content.best ?? '';
    this.best.hidden = content.best === undefined;
    this.chancesLost.textContent = content.chancesLost;
    this.score.textContent = content.score === undefined ? '' : String(content.score);
    this.scoreRow.hidden = content.score === undefined;
    this.leagueText.textContent = content.league ?? '';
    this.league.hidden = content.league === undefined;
    this.button.textContent = content.action;
    this.onAction = content.onAction;
    this.secondary.textContent = content.secondary.label;
    this.secondary.href = content.secondary.href;
    this.element.hidden = false;
    this.element.scrollTop = 0;
    this.button.focus();
  }

  hide(): void {
    this.element.hidden = true;
    this.onAction = null;
  }

  get visible(): boolean {
    return !this.element.hidden;
  }
}
