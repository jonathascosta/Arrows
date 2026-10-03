import { el } from './dom.ts';

export interface OverlayContent {
  readonly kind: 'won' | 'lost';
  readonly title: string;
  readonly body: string;
  readonly action: string;
  readonly onAction: () => void;
  /** A quieter way out, such as "Home". */
  readonly secondary?: { readonly label: string; readonly href: string };
}

/**
 * The end-of-board sheet over the board (docs/DESIGN.md, Lose): a serif title,
 * one line, a primary button and an optional text link.
 */
export class Overlay {
  readonly element: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly body: HTMLParagraphElement;
  private readonly button: HTMLButtonElement;
  private readonly secondary: HTMLAnchorElement;
  private onAction: (() => void) | null = null;

  constructor(doc: Document) {
    this.title = el(doc, 'h2', { id: 'overlay-title' });
    this.body = el(doc, 'p', { id: 'overlay-body' });
    this.button = el(doc, 'button', { class: 'button primary', type: 'button' });
    this.button.addEventListener('click', () => this.onAction?.());
    this.secondary = el(doc, 'a', { class: 'text-button' });
    this.element = el(
      doc,
      'div',
      {
        class: 'overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'overlay-title',
        'aria-describedby': 'overlay-body',
      },
      [el(doc, 'div', { class: 'sheet' }, [this.title, this.body, this.button, this.secondary])],
    );
    this.element.hidden = true;
  }

  show(content: OverlayContent): void {
    this.title.textContent = content.title;
    this.body.textContent = content.body;
    this.button.textContent = content.action;
    this.onAction = content.onAction;
    if (content.secondary === undefined) {
      this.secondary.hidden = true;
    } else {
      this.secondary.hidden = false;
      this.secondary.textContent = content.secondary.label;
      this.secondary.href = content.secondary.href;
    }
    this.element.dataset.overlay = content.kind;
    this.element.hidden = false;
    this.button.focus();
  }

  hide(): void {
    this.element.hidden = true;
    this.onAction = null;
    delete this.element.dataset.overlay;
  }

  get visible(): boolean {
    return !this.element.hidden;
  }
}
