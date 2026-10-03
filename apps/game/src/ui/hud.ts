import type { Tier } from '@arrows/engine';
import { t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from './dom.ts';

/** The top bar (back, title, tier) and the row under it (drops, timer, hint). */
export class Hud {
  readonly topbar: HTMLElement;
  readonly row: HTMLElement;
  readonly hintButton: HTMLButtonElement;
  private readonly title: HTMLHeadingElement;
  private readonly tier: HTMLParagraphElement;
  private readonly drops: HTMLDivElement;
  private readonly time: HTMLSpanElement;
  private readonly timer: HTMLDivElement;
  private readonly theme: Theme;

  constructor(doc: Document, theme: Theme, backHref: string) {
    this.theme = theme;
    const back = el(
      doc,
      'a',
      { class: 'icon-button back', href: backHref, 'aria-label': t('nav.back') },
      [iconSpan(doc, theme.icons.back, 'icon')],
    );
    this.title = el(doc, 'h1');
    this.tier = el(doc, 'p', { class: 'tier' });
    this.topbar = el(doc, 'header', { class: 'topbar' }, [
      back,
      el(doc, 'div', { class: 'title' }, [this.title, this.tier]),
      el(doc, 'span', { class: 'topbar-end' }),
    ]);

    this.drops = el(doc, 'div', { class: 'drops', role: 'img' });
    this.time = el(doc, 'span', { class: 'time' }, ['00:00']);
    this.timer = el(doc, 'div', { class: 'timer', role: 'timer' }, [
      iconSpan(doc, theme.icons.clock, 'icon'),
      this.time,
    ]);
    this.hintButton = el(
      doc,
      'button',
      { class: 'icon-button hint', type: 'button', 'aria-label': t('hud.hint') },
      [iconSpan(doc, theme.icons.hint, 'icon')],
    );
    this.row = el(doc, 'div', { class: 'hud' }, [this.drops, this.timer, this.hintButton]);
  }

  setTitle(title: string, tierLabel: string, tier: Tier): void {
    this.title.textContent = title;
    this.tier.textContent = tierLabel;
    this.tier.dataset.tier = tier;
  }

  /** Draws `total` drops, the first `left` of them full. */
  setDrops(left: number, total: number): void {
    const doc = this.drops.ownerDocument;
    if (this.drops.childElementCount !== total) {
      this.drops.replaceChildren(
        ...Array.from({ length: total }, () => iconSpan(doc, this.theme.icons.drop, 'drop')),
      );
    }
    [...this.drops.children].forEach((drop, i) => drop.classList.toggle('lost', i >= left));
    this.drops.dataset.lives = String(left);
    this.drops.setAttribute('aria-label', t('hud.drops', { n: left, total }));
  }

  setTime(text: string): void {
    if (this.time.textContent === text) return;
    this.time.textContent = text;
    this.timer.setAttribute('aria-label', t('hud.timer', { time: text }));
  }

  setHintEnabled(enabled: boolean): void {
    this.hintButton.disabled = !enabled;
  }
}
