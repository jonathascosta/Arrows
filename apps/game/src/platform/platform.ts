import { adsFor } from '../ads/ads.ts';
import type { AdProvider } from '../ads/ads.ts';
import { browserStore } from '../persistence/store.ts';
import type { KeyValueStore } from '../persistence/store.ts';
import type { CuePlayer } from './cues.ts';

/**
 * The player's choices about ads (docs/PRODUCT.md, Monetization), which
 * Settings offers where the law asks for a way back to them.
 */
export interface PrivacyChoices {
  /** Whether Settings must offer them; known once the app has asked for consent. */
  readonly required: () => boolean;
  /** Google's form to change them. */
  readonly show: () => Promise<void>;
}

/**
 * What differs between the web and the iOS app (docs/ARCHITECTURE.md, iOS):
 * where the player's records are kept, which ads show, the haptics, and the
 * choices about ads. Everything else, the sounds included, is the same code on both.
 */
export interface Platform {
  readonly store: KeyValueStore;
  readonly ads: AdProvider;
  /** The phone's haptics, or null where there are none (the web). */
  readonly haptics: CuePlayer | null;
  /** The choices about ads, or null where no ad network runs (the web). */
  readonly privacy: PrivacyChoices | null;
}

/** The web: localStorage, no ads unless the test ads are on, no haptics. */
export function webPlatform(doc: Document): Platform {
  const store = browserStore();
  return { store, ads: adsFor(store, doc), haptics: null, privacy: null };
}
