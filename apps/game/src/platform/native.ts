import { AdMob } from '@capacitor-community/admob';
import { Haptics as DeviceHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AdMobAds, TEST_AD_UNITS } from '../ads/admob.ts';
import { adsFor } from '../ads/ads.ts';
import { AdConsent } from '../ads/consent.ts';
import { PreferencesStore } from '../persistence/preferences.ts';
import { browserStore } from '../persistence/store.ts';
import type { Cue, CuePlayer } from './cues.ts';
import type { Platform } from './platform.ts';

/**
 * The iOS app, wrapped by Capacitor (docs/ARCHITECTURE.md, iOS). Loaded only
 * there, so the web build never runs the plugins.
 */

/** A plugin call that fails is reported and never stops the game. */
function report(error: unknown): void {
  console.warn('Arrows:', error);
}

/**
 * The cues on the Taptic Engine: a light tick, a warning, success and error;
 * a promotion is a heavy tap and success.
 */
const CUES: Record<Cue, () => Promise<void>> = {
  remove: () => DeviceHaptics.impact({ style: ImpactStyle.Light }),
  block: () => DeviceHaptics.notification({ type: NotificationType.Warning }),
  win: () => DeviceHaptics.notification({ type: NotificationType.Success }),
  lose: () => DeviceHaptics.notification({ type: NotificationType.Error }),
  promote: () =>
    DeviceHaptics.impact({ style: ImpactStyle.Heavy }).then(() =>
      DeviceHaptics.notification({ type: NotificationType.Success }),
    ),
};

const haptics: CuePlayer = {
  play: (cue) => void CUES[cue]().catch(report),
};

/**
 * The ad units: the owner's, when the build passes them (VITE_ADMOB_INTERSTITIAL_ID
 * and VITE_ADMOB_REWARDED_ID, see the TestFlight job), Google's test units otherwise.
 */
const unit = (value: string | undefined, fallback: string): string =>
  value === undefined || value === '' ? fallback : value;
const UNITS = {
  interstitial: unit(import.meta.env.VITE_ADMOB_INTERSTITIAL_ID, TEST_AD_UNITS.interstitial),
  rewarded: unit(import.meta.env.VITE_ADMOB_REWARDED_ID, TEST_AD_UNITS.rewarded),
};

export async function nativePlatform(doc: Document): Promise<Platform> {
  const store = await PreferencesStore.load(Preferences, report);
  // Dark text on the paper colour; the page itself keeps clear of the bar (safe-area insets).
  StatusBar.setStyle({ style: Style.Light }).catch(report);
  // The player's choices about ads first, then the SDK; the ads load once it has
  // started (asking again when an ad is needed, if that failed), and the game does
  // not wait for any of it.
  const consent = new AdConsent(AdMob, report);
  const admob = new AdMobAds(AdMob, {
    units: UNITS,
    ready: () => consent.ready(),
    onError: report,
  });
  admob.preload();
  const privacy = {
    required: () => consent.privacyOptionsRequired,
    show: () => consent.showPrivacyOptions(),
  };
  // The test-ads switch is a setting of the puzzle picker, which keeps it in the web
  // view's storage (dev.ts), not with the player's records.
  return { store, ads: adsFor(browserStore(), doc, admob), haptics, privacy };
}
