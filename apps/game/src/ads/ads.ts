import type { KeyValueStore } from '../persistence/store.ts';
import { DebugAds } from './debug.ts';

/**
 * Where the game shows ads (docs/PRODUCT.md, Monetization): an interstitial
 * between a won board and its score screen, and a rewarded ad before every
 * hint. The web build shows none; the iOS build (T8) puts an ad network here.
 */
export interface AdProvider {
  /** A full-screen ad. Resolves when it has closed, at once when there is none. */
  showInterstitial(): Promise<void>;
  /** A rewarded ad. Resolves with whether the player earned the reward. */
  showRewarded(): Promise<boolean>;
}

/** The web build: no ad ever shows, and every reward is earned at once. */
export const NO_ADS: AdProvider = {
  showInterstitial: () => Promise.resolve(),
  showRewarded: () => Promise.resolve(true),
};

/** The setting that turns the test ads on (the puzzle picker sets it). */
export const ADS_KEY = 'arrows.ads';

/** The test ads when the setting asks for them; otherwise the platform's ads, none on the web. */
export function adsFor(store: KeyValueStore, doc: Document, ads: AdProvider = NO_ADS): AdProvider {
  return store.getItem(ADS_KEY) === 'test' ? new DebugAds(doc) : ads;
}
