import { el } from './dom.ts';

export interface OverlayContent {
  readonly kind: 'won' | 'lost';
  readonly title: string;
  readonly body: string;
  readonly action: string;
  readonly onAction: () => void;
}

/** The end-of-board card over the board: a title, one line, one button. */
export class Overlay {
  readonly element: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly body: HTMLParagraphElement;
  private readonly button: HTMLButtonElement;
  private onAction: (() => void) | null = null;

  constructor(doc: Document) {
    this.title = el(doc, 'h2', { id: 'overlay-title' });
    this.body = el(doc, 'p', { id: 'overlay-body' });
    this.button = el(doc, 'button', { class: 'button', type: 'button' });
    this.button.addEventListener('click', () => this.onAction?.());
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
      [el(doc, 'div', { class: 'card' }, [this.title, this.body, this.button])],
    );
    this.element.hidden = true;
  }

  show(content: OverlayContent): void {
    this.title.textContent = content.title;
    this.body.textContent = content.body;
    this.button.textContent = content.action;
    this.onAction = content.onAction;
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
