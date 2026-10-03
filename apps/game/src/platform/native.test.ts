import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdMobAds } from '../ads/admob.ts';
import { ADS_KEY } from '../ads/ads.ts';
import { PreferencesStore } from '../persistence/preferences.ts';
import { nativePlatform } from './native.ts';

// In jsdom the plugins answer through Capacitor's web implementations.
describe('nativePlatform', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps records in Preferences and shows AdMob ads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const platform = await nativePlatform();
    expect(platform.store).toBeInstanceOf(PreferencesStore);
    expect(platform.ads).toBeInstanceOf(AdMobAds);
    // The choices about ads: offered once the consent check says the law asks for them.
    expect(platform.privacy).not.toBeNull();
    expect(platform.privacy?.required()).toBe(false);
  });

  it('always shows the real network: the app has no puzzle picker to turn on test ads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Left over from a web view that once ran the picker, the switch changes nothing.
    localStorage.setItem(ADS_KEY, 'test');
    const platform = await nativePlatform();
    expect(platform.ads).toBeInstanceOf(AdMobAds);
  });
});
