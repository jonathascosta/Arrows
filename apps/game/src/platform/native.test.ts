import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdMobAds } from '../ads/admob.ts';
import { ADS_KEY } from '../ads/ads.ts';
import { DebugAds } from '../ads/debug.ts';
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
    const platform = await nativePlatform(document);
    expect(platform.store).toBeInstanceOf(PreferencesStore);
    expect(platform.ads).toBeInstanceOf(AdMobAds);
    // The choices about ads: offered once the consent check says the law asks for them.
    expect(platform.privacy).not.toBeNull();
    expect(platform.privacy?.required()).toBe(false);
  });

  it('shows the test ads when the puzzle picker turned them on, as on the web', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // The picker (dev.ts) writes the setting to the web view's storage.
    localStorage.setItem(ADS_KEY, 'test');
    const platform = await nativePlatform(document);
    expect(platform.ads).toBeInstanceOf(DebugAds);
    // The setting is not one of the player's records.
    expect(platform.store.getItem(ADS_KEY)).toBeNull();
  });
});
