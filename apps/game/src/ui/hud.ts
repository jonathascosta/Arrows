import type { Tier } from '@arrows/engine';
import { t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { Chances } from './chances.ts';
import { el, iconSpan } from './dom.ts';

/**
 * The play screen's chrome (docs/DESIGN.md, Board): a top bar with the back
 * button, the title and tier on the left and the chances and timer on the
 * right; a tool bar under the board with Grid and Hint.
 */
export class Hud {
  readonly topbar: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly gridButton: HTMLButtonElement;
  readonly hintButton: HTMLButtonElement;
  private readonly title: HTMLHeadingElement;
  private readonly tier: HTMLParagraphElement;
  private readonly chances: Chances;
  private readonly time: HTMLSpanElement;
  private readonly hintLabel: HTMLSpanElement;
  /**
   * "(plays an ad)" and the AD badge: gone while a hint shows, since showing it
   * again is free, and while the ad loads, since the label says so.
   */
  private readonly adMarks: readonly HTMLSpanElement[];
  private hintLoading = false;
  private hintShown = false;
  private readonly back: HTMLAnchorElement;

  constructor(doc: Document, theme: Theme, backHref: string, reducedMotion: () => boolean) {
    const back = el(
      doc,
      'a',
      { class: 'round-button back', href: backHref, 'aria-label': t('nav.back') },
      [iconSpan(doc, theme.icons.back, 'icon')],
    );
    this.back = back;
    this.title = el(doc, 'h1');
    this.tier = el(doc, 'p', { class: 'tier' });
    this.chances = new Chances(doc, theme, reducedMotion);
    this.time = el(
      doc,
      'span',
      { class: 'time', role: 'timer', 'aria-label': t('hud.timer', { time: '00:00' }) },
      ['00:00'],
    );
    this.topbar = el(doc, 'header', { class: 'topbar' }, [
      back,
      el(doc, 'div', { class: 'title' }, [this.title, this.tier]),
      el(doc, 'div', { class: 'status' }, [
        this.chances.element,
        el(doc, 'span', { class: 'status-divider', 'aria-hidden': 'true' }),
        this.time,
      ]),
    ]);

    this.gridButton = el(
      doc,
      'button',
      { class: 'tool grid-toggle', type: 'button', 'aria-pressed': 'false' },
      [iconSpan(doc, theme.icons.grid, 'icon'), el(doc, 'span', {}, [t('tools.grid')])],
    );
    this.hintLabel = el(doc, 'span', { class: 'tool-label' }, [t('tools.hint')]);
    this.adMarks = [
      el(doc, 'span', { class: 'sr-only' }, [t('tools.adNote')]),
      el(doc, 'span', { class: 'ad-badge', 'aria-hidden': 'true' }, [t('tools.ad')]),
    ];
    this.hintButton = el(doc, 'button', { class: 'tool hint', type: 'button' }, [
      iconSpan(doc, theme.icons.hint, 'icon'),
      this.hintLabel,
      ...this.adMarks,
    ]);
    this.toolbar = el(doc, 'nav', { class: 'toolbar' }, [this.gridButton, this.hintButton]);
  }

  /** Where the back button leads, and what it says to screen readers. */
  setBack(href: string, label: string): void {
    this.back.setAttribute('href', href);
    this.back.setAttribute('aria-label', label);
  }

  setTitle(title: string, tierLabel: string, tier: Tier): void {
    this.title.textContent = title;
    this.tier.textContent = tierLabel;
    this.tier.dataset.tier = tier;
    this.fitTitle();
  }

  /**
   * Puts the chances and the timer on a row of their own when the title or its
   * line would be cut next to them; measured again on resize and once the
   * fonts are in.
   */
  fitTitle(): void {
    this.topbar.classList.remove('stacked');
    const cut = (element: HTMLElement): boolean => element.scrollWidth > element.clientWidth + 1;
    this.topbar.classList.toggle('stacked', cut(this.title) || cut(this.tier));
  }

  setChances(left: number, total: number): void {
    this.chances.set(left, total);
  }

  /** Resolves when a breaking chance has settled. */
  chancesIdle(): Promise<void> {
    return this.chances.idle();
  }

  setTime(text: string): void {
    if (this.time.textContent === text) return;
    this.time.textContent = text;
    this.time.setAttribute('aria-label', t('hud.timer', { time: text }));
  }

  setHintEnabled(enabled: boolean): void {
    this.hintButton.disabled = !enabled;
  }

  /** "Loading ad…" while a hint's rewarded ad is on its way; "Hint" again after. */
  setHintLoading(loading: boolean): void {
    this.hintLoading = loading;
    this.drawHint();
  }

  /** "Hint shown", without the ad marks, while a hinted arrow is on the board. */
  setHintShown(shown: boolean): void {
    this.hintShown = shown;
    this.drawHint();
  }

  private drawHint(): void {
    this.hintLabel.textContent = t(
      this.hintLoading ? 'tools.hintLoading' : this.hintShown ? 'tools.hintShown' : 'tools.hint',
    );
    this.hintButton.classList.toggle('shown', this.hintShown && !this.hintLoading);
    for (const mark of this.adMarks) mark.hidden = this.hintLoading || this.hintShown;
  }
}
