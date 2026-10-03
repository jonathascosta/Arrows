import { adsFor } from '../ads/ads.ts';
import type { AdProvider } from '../ads/ads.ts';
import { browserStore } from '../persistence/store.ts';
import type { KeyValueStore } from '../persistence/store.ts';
import { NO_HAPTICS } from './haptics.ts';
import type { Haptics } from './haptics.ts';

/**
 * What differs between the web and the iOS app (docs/ARCHITECTURE.md, iOS):
 * where the player's records are kept, which ads show, and the haptics.
 * Everything else is the same code on both.
 */
export interface Platform {
  readonly store: KeyValueStore;
  readonly ads: AdProvider;
  readonly haptics: Haptics;
}

/** The web: localStorage, no ads unless the test ads are on, no haptics. */
export function webPlatform(doc: Document): Platform {
  const store = browserStore();
  return { store, ads: adsFor(store, doc), haptics: NO_HAPTICS };
}
