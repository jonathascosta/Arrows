import { afterEach, describe, expect, it } from 'vitest';
import { ADS_KEY, NO_ADS } from '../ads/ads.ts';
import { DebugAds } from '../ads/debug.ts';
import { webPlatform } from './platform.ts';

describe('webPlatform', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps records in localStorage, shows no ads and plays no haptics', () => {
    const platform = webPlatform(document);
    platform.store.setItem('arrows.test', 'kept');
    expect(localStorage.getItem('arrows.test')).toBe('kept');
    expect(platform.ads).toBe(NO_ADS);
    expect(platform.haptics).toBeNull();
    // No ad network on the web: no choices about ads to offer.
    expect(platform.privacy).toBeNull();
  });

  it('shows the test ads when the puzzle picker turned them on', () => {
    localStorage.setItem(ADS_KEY, 'test');
    expect(webPlatform(document).ads).toBeInstanceOf(DebugAds);
  });
});
