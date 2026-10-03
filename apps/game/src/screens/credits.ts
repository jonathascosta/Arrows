import type { Credit } from '../credits/licences.ts';
import { t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el, iconSpan } from '../ui/dom.ts';

export interface CreditsScreenOptions {
  readonly theme: Theme;
  readonly homeHref: string;
  readonly fonts: readonly Credit[];
  readonly software: readonly Credit[];
}

/**
 * Credits (docs/PRODUCT.md, Sound, haptics and settings): the fonts and the
 * software the game is made with, each with its licence in full, as their
 * licences ask, and where the ads come from. Settings links here.
 */
export class CreditsScreen {
  readonly element: HTMLElement;

  constructor(root: HTMLElement, options: CreditsScreenOptions) {
    const doc = root.ownerDocument;
    const top = el(doc, 'header', { class: 'topbar' }, [
      el(
        doc,
        'a',
        { class: 'round-button back', href: options.homeHref, 'aria-label': t('nav.back') },
        [iconSpan(doc, options.theme.icons.back, 'icon')],
      ),
      el(doc, 'div', { class: 'title' }, [el(doc, 'h1', {}, [t('credits.title')])]),
    ]);
    const section = (id: string, title: string, body: HTMLElement[]): HTMLElement =>
      el(doc, 'section', { class: 'credits-section', 'aria-labelledby': id }, [
        el(doc, 'h2', { class: 'section-title', id }, [title]),
        ...body,
      ]);
    this.element = el(doc, 'main', { class: 'credits-screen' }, [
      top,
      el(doc, 'p', { class: 'credits-intro' }, [t('credits.intro')]),
      section('credits-fonts', t('credits.fonts'), [this.list(doc, options.fonts)]),
      section('credits-software', t('credits.software'), [this.list(doc, options.software)]),
      section('credits-ads', t('credits.ads'), [
        el(doc, 'p', { class: 'credits-note' }, [t('credits.adsBody')]),
      ]),
    ]);
    root.replaceChildren(this.element);
    doc.title = `${t('credits.title')} · ${t('app.name')}`;
  }

  destroy(): void {
    this.element.remove();
  }

  /** A card per credit: its name, its licence, and the licence's text behind a disclosure. */
  private list(doc: Document, credits: readonly Credit[]): HTMLElement {
    return el(
      doc,
      'ul',
      { class: 'credits-list' },
      credits.map((credit) =>
        el(doc, 'li', { class: 'card credit' }, [
          el(doc, 'h3', { class: 'credit-name' }, [credit.name]),
          el(doc, 'p', { class: 'credit-licence' }, [
            t('credits.licence', { licence: credit.licence }),
          ]),
          el(doc, 'details', { class: 'credit-text' }, [
            el(doc, 'summary', {}, [t('credits.text')]),
            // The licence is a legal text: as written, in English.
            el(doc, 'pre', { lang: 'en' }, [credit.text.trim()]),
          ]),
        ]),
      ),
    );
  }
}
