import { afterEach, describe, expect, it } from 'vitest';
import { FONTS, SOFTWARE } from '../credits/licences.ts';
import { setLocale } from '../strings.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { CreditsScreen } from './credits.ts';

function mount(): HTMLElement {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  new CreditsScreen(root, {
    theme: DEFAULT_THEME,
    homeHref: './',
    fonts: FONTS,
    software: SOFTWARE,
  });
  return root;
}

describe('CreditsScreen', () => {
  afterEach(() => setLocale('en'));

  it('names each font and library with its licence, in full', () => {
    const root = mount();
    expect(document.title).toBe('Credits · Arrows');
    expect(root.querySelector('h1')?.textContent).toBe('Credits');
    expect(root.querySelector('.back')?.getAttribute('href')).toBe('./');
    const fonts = [...root.querySelectorAll('#credits-fonts + .credits-list .credit')];
    expect(fonts.map((font) => font.querySelector('h3')?.textContent)).toEqual([
      'Instrument Serif',
      'Geist',
    ]);
    expect(fonts[0]?.querySelector('.credit-licence')?.textContent).toBe(
      'Licence: SIL Open Font License 1.1',
    );
    // The licence as the package ships it: its copyright and the whole OFL.
    const text = fonts[0]?.querySelector('pre')?.textContent ?? '';
    expect(text).toMatch(/^Copyright 2022 The Instrument Serif Project Authors/);
    expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(text).toContain('TERMINATION');
    const software = [...root.querySelectorAll('#credits-software + .credits-list .credit')];
    expect(software).toHaveLength(SOFTWARE.length);
    for (const item of software) {
      expect(item.querySelector('pre')?.textContent).toMatch(
        /MIT License|Permission is hereby granted/,
      );
    }
    expect(root.querySelector('#credits-ads')?.parentElement?.textContent).toContain(
      'Google AdMob',
    );
  });

  it('speaks Portuguese around the licences, which stay as written', () => {
    setLocale('pt');
    const root = mount();
    expect(root.querySelector('h1')?.textContent).toBe('Créditos');
    expect(root.querySelector('#credits-fonts')?.textContent).toBe('Fontes');
    expect(root.querySelector('summary')?.textContent).toBe('Texto da licença');
    expect(root.querySelector('pre')?.getAttribute('lang')).toBe('en');
  });
});
