import type { CueSettings } from '../platform/cues.ts';
import { t } from '../strings.ts';
import { el } from './dom.ts';

export interface SettingsSheetOptions {
  readonly settings: CueSettings;
  /** Only the iOS app has haptics: the web shows no switch for them. */
  readonly hapticsAvailable: boolean;
  /** The puzzle picker, a tool for testing: the web build only, null in the app. */
  readonly pickerHref: string | null;
  readonly creditsHref: string;
  readonly privacyHref: string;
  /** Opens the choices about ads, where the law asks for a way back to them; else null. */
  readonly privacyChoices: (() => void) | null;
  readonly onChange: (change: Partial<CueSettings>) => void;
  readonly onClose: () => void;
}

/**
 * The home menu's Settings (docs/PRODUCT.md, Sound, haptics and settings): a
 * sheet like the others, with a switch per setting, Done, and links to the
 * privacy choices (where required), the privacy policy, the credits and, on the
 * web only, the puzzle picker. Escape closes it too.
 */
export class SettingsSheet {
  readonly element: HTMLDivElement;
  private readonly first: HTMLButtonElement;
  private readonly onKey: (event: KeyboardEvent) => void;

  constructor(doc: Document, options: SettingsSheetOptions) {
    const values = { ...options.settings };
    const toggle = (name: keyof CueSettings, label: string): HTMLButtonElement => {
      const button = el(
        doc,
        'button',
        {
          class: 'setting',
          type: 'button',
          role: 'switch',
          'aria-checked': String(values[name]),
          'data-setting': name,
        },
        [
          el(doc, 'span', { class: 'setting-label' }, [label]),
          el(doc, 'span', { class: 'switch', 'aria-hidden': 'true' }, [
            el(doc, 'span', { class: 'switch-knob' }),
          ]),
        ],
      );
      button.addEventListener('click', () => {
        values[name] = !values[name];
        button.setAttribute('aria-checked', String(values[name]));
        options.onChange({ [name]: values[name] });
      });
      return button;
    };
    const switches = [toggle('sound', t('settings.sound'))];
    if (options.hapticsAvailable) switches.push(toggle('haptics', t('settings.haptics')));
    this.first = switches[0]!;
    const done = el(doc, 'button', { class: 'button primary', type: 'button' }, [
      t('settings.done'),
    ]);
    done.addEventListener('click', () => options.onClose());
    this.element = el(
      doc,
      'div',
      {
        class: 'overlay floating',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'settings-title',
        'data-overlay': 'settings',
      },
      [
        el(doc, 'div', { class: 'sheet settings-sheet' }, [
          el(doc, 'h2', { id: 'settings-title' }, [t('settings.title')]),
          el(doc, 'div', { class: 'settings-list' }, switches),
          done,
          el(doc, 'nav', { class: 'settings-links', 'aria-label': t('settings.title') }, [
            ...(options.privacyChoices === null ? [] : [this.privacyButton(doc, options)]),
            el(doc, 'a', { class: 'text-button', href: options.privacyHref }, [
              t('settings.privacyPolicy'),
            ]),
            el(doc, 'a', { class: 'text-button', href: options.creditsHref }, [
              t('settings.credits'),
            ]),
            ...(options.pickerHref === null
              ? []
              : [
                  el(doc, 'a', { class: 'text-button', href: options.pickerHref }, [
                    t('settings.picker'),
                  ]),
                ]),
          ]),
        ]),
      ],
    );
    // Wherever focus is while the sheet is open, as with a tap above it.
    this.onKey = (event) => {
      if (event.key === 'Escape') options.onClose();
    };
    doc.addEventListener('keydown', this.onKey);
  }

  private privacyButton(doc: Document, options: SettingsSheetOptions): HTMLButtonElement {
    const button = el(doc, 'button', { class: 'text-button privacy-choices', type: 'button' }, [
      t('settings.privacyChoices'),
    ]);
    button.addEventListener('click', () => options.privacyChoices?.());
    return button;
  }

  /** Takes the sheet away and stops listening for Escape. */
  remove(): void {
    this.element.ownerDocument.removeEventListener('keydown', this.onKey);
    this.element.remove();
  }

  /** Moves focus into the sheet, onto its first switch. */
  focus(): void {
    this.first.focus();
  }
}
