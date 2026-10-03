import type { CueSettings } from '../platform/cues.ts';
import { t } from '../strings.ts';
import { el } from './dom.ts';

export interface SettingsSheetOptions {
  readonly settings: CueSettings;
  /** Only the iOS app has haptics: the web shows no switch for them. */
  readonly hapticsAvailable: boolean;
  readonly pickerHref: string;
  readonly onChange: (change: Partial<CueSettings>) => void;
  readonly onClose: () => void;
}

/**
 * The home menu's Settings (docs/PRODUCT.md, Sound, haptics and settings): a
 * sheet like the others, with a switch per setting, Done, and the puzzle
 * picker. Escape closes it too.
 */
export class SettingsSheet {
  readonly element: HTMLDivElement;
  private readonly first: HTMLButtonElement;

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
          el(doc, 'a', { class: 'text-button', href: options.pickerHref }, [t('settings.picker')]),
        ]),
      ],
    );
    this.element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') options.onClose();
    });
  }

  /** Moves focus into the sheet, onto its first switch. */
  focus(): void {
    this.first.focus();
  }
}
