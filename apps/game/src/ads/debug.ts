import { t } from '../strings.ts';
import { el } from '../ui/dom.ts';
import type { AdProvider } from './ads.ts';

type AdKind = 'interstitial' | 'rewarded';

/**
 * Test ads, to try the flow without an ad network: a full-screen card that
 * says which ad would show. The interstitial has one way out; the rewarded
 * ad has two, so both answers can be tried: watched to the end (the reward)
 * or closed early (no reward). The card counts what it showed in
 * `data-interstitials` and `data-rewarded`, for tests and for a look in the
 * inspector.
 */
export class DebugAds implements AdProvider {
  readonly element: HTMLDivElement;
  private readonly doc: Document;
  private readonly title: HTMLHeadingElement;
  private readonly body: HTMLParagraphElement;
  private readonly actions: HTMLDivElement;
  private readonly counts: Record<AdKind, number> = { interstitial: 0, rewarded: 0 };
  private showing = false;

  constructor(doc: Document) {
    this.doc = doc;
    this.title = el(doc, 'h2', { id: 'test-ad-title' }, [t('ads.test.title')]);
    this.body = el(doc, 'p', { id: 'test-ad-body' });
    this.actions = el(doc, 'div', { class: 'test-ad-actions' });
    this.element = el(
      doc,
      'div',
      {
        class: 'test-ad',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'test-ad-title',
        'aria-describedby': 'test-ad-body',
        'data-interstitials': '0',
        'data-rewarded': '0',
      },
      [
        el(doc, 'div', { class: 'test-ad-card' }, [
          el(doc, 'span', { class: 'ad-badge' }, [t('tools.ad')]),
          this.title,
          this.body,
          this.actions,
        ]),
      ],
    );
    this.element.hidden = true;
  }

  showInterstitial(): Promise<void> {
    return this.show('interstitial').then(() => undefined);
  }

  showRewarded(): Promise<boolean> {
    return this.show('rewarded');
  }

  private show(kind: AdKind): Promise<boolean> {
    // One ad at a time, like an ad network: a second call while one shows earns nothing.
    if (this.showing) return Promise.resolve(false);
    this.showing = true;
    this.counts[kind]++;
    this.element.dataset.interstitials = String(this.counts.interstitial);
    this.element.dataset.rewarded = String(this.counts.rewarded);
    this.element.dataset.kind = kind;
    this.body.textContent = t(
      kind === 'interstitial' ? 'ads.test.interstitial' : 'ads.test.rewarded',
    );
    if (!this.element.isConnected) this.doc.body.append(this.element);
    // Where focus goes back to, taken before the page behind goes out of reach.
    const focused = this.doc.activeElement;
    // Everything else is out of reach while the ad shows, as under a real one.
    const behind = [...this.doc.body.children].filter(
      (child): child is HTMLElement => child !== this.element && !child.hasAttribute('inert'),
    );
    for (const element of behind) element.toggleAttribute('inert', true);

    return new Promise((resolve) => {
      const close = (reward: boolean): void => {
        this.showing = false;
        this.element.hidden = true;
        delete this.element.dataset.kind;
        this.actions.replaceChildren();
        for (const element of behind) element.toggleAttribute('inert', false);
        if (focused instanceof HTMLElement && focused.isConnected) focused.focus();
        resolve(reward);
      };
      const button = (label: string, className: string, reward: boolean): HTMLButtonElement => {
        const element = el(this.doc, 'button', { class: className, type: 'button' }, [label]);
        element.addEventListener('click', () => close(reward), { once: true });
        return element;
      };
      const buttons =
        kind === 'interstitial'
          ? [button(t('ads.test.close'), 'button', true)]
          : [
              button(t('ads.test.finish'), 'button', true),
              button(t('ads.test.skip'), 'text-button', false),
            ];
      this.actions.replaceChildren(...buttons);
      this.element.hidden = false;
      buttons[0]!.focus();
    });
  }
}
