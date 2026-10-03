import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config.ts';

describe('the iOS wrapper', () => {
  it('lets the text screens scroll', () => {
    // Turned off, a screen taller than the phone (Credits, the league) cannot be scrolled.
    expect(config.ios?.scrollEnabled).not.toBe(false);
  });
});
