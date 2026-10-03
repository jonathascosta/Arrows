import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTextScale, preferredTextScale, TEXT_SCALE_RANGE } from './textSize.ts';

describe('preferredTextScale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'CSS');
  });

  /** jsdom has no `CSS`: a browser that does (or does not) know the font. */
  function css(knowsFont: boolean): void {
    Object.defineProperty(window, 'CSS', {
      value: { supports: () => knowsFont },
      configurable: true,
    });
  }

  /** A WebKit that knows the Dynamic Type font, at `px` for the body. */
  function webkit(px: string): void {
    css(true);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: px,
    } as CSSStyleDeclaration);
  }

  it('is 1 where the system font is unknown, or there is no CSS object', () => {
    expect(preferredTextScale(document)).toBe(1);
    css(false);
    expect(preferredTextScale(document)).toBe(1);
  });

  it('follows the phone’s text size, within the range the screens fit', () => {
    webkit('17px');
    expect(preferredTextScale(document)).toBe(1);
    webkit('21.25px');
    expect(preferredTextScale(document)).toBe(1.25);
    webkit('53px');
    expect(preferredTextScale(document)).toBe(TEXT_SCALE_RANGE.max);
    webkit('12px');
    expect(preferredTextScale(document)).toBe(TEXT_SCALE_RANGE.min);
    webkit('not a size');
    expect(preferredTextScale(document)).toBe(1);
    // The probe is gone.
    expect(document.body.childElementCount).toBe(0);
  });

  it('sets the scale the stylesheet reads', () => {
    applyTextScale(document, 1.25);
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.25');
  });
});
