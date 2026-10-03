import type { AdProvider } from './ads.ts';

/** A listener handle, as Capacitor plugins return them. */
export interface ListenerHandle {
  remove(): Promise<void>;
}

/**
 * What the provider needs of the AdMob plugin (`@capacitor-community/admob`):
 * load an ad, show it, and hear how it ended.
 */
export interface AdMobApi {
  prepareInterstitial(options: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showInterstitial(): Promise<void>;
  prepareRewardVideoAd(options: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
  addListener(eventName: string, listener: () => void): Promise<ListenerHandle>;
}

/** The plugin's event names (its `InterstitialAdPluginEvents` and `RewardAdPluginEvents`). */
export const ADMOB_EVENTS = {
  interstitialDismissed: 'interstitialAdDismissed',
  interstitialFailedToShow: 'interstitialAdFailedToShow',
  rewardedDismissed: 'onRewardedVideoAdDismissed',
  rewardedFailedToShow: 'onRewardedVideoAdFailedToShow',
  rewarded: 'onRewardedVideoAdReward',
} as const;

export interface AdUnits {
  readonly interstitial: string;
  readonly rewarded: string;
}

/**
 * Google's sample ad units for iOS, which always fill and never pay: the
 * build uses them until the owner's own units are passed at build time.
 */
export const TEST_AD_UNITS: AdUnits = {
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
};

export interface AdMobOptions {
  readonly units: AdUnits;
  /** How long a hint or a score waits for an ad still loading before going without. */
  readonly waitMs?: number;
  readonly onError?: (error: unknown) => void;
}

type Kind = 'interstitial' | 'rewarded';

const WAIT_MS = 4000;

/**
 * Ads from AdMob (docs/ARCHITECTURE.md, Ads). Each kind of ad is loaded ahead,
 * so it shows at once when its moment comes, and the next one loads as soon as
 * it closes. An ad still loading after `waitMs` is gone without: no
 * interstitial, and no hint. A load that fails is tried again the next time.
 */
export class AdMobAds implements AdProvider {
  private readonly api: AdMobApi;
  private readonly units: AdUnits;
  private readonly waitMs: number;
  private readonly onError: (error: unknown) => void;
  private readonly isTesting: boolean;
  private readonly loads: Record<Kind, Promise<boolean> | null> = {
    interstitial: null,
    rewarded: null,
  };

  constructor(api: AdMobApi, options: AdMobOptions) {
    this.api = api;
    this.units = options.units;
    this.waitMs = options.waitMs ?? WAIT_MS;
    this.onError = options.onError ?? (() => undefined);
    this.isTesting =
      options.units.interstitial === TEST_AD_UNITS.interstitial &&
      options.units.rewarded === TEST_AD_UNITS.rewarded;
  }

  /** Starts loading both ads, so the first hint and the first score need not wait. */
  preload(): void {
    this.load('interstitial');
    this.load('rewarded');
  }

  async showInterstitial(): Promise<void> {
    if (!(await this.ready('interstitial'))) return;
    await this.present('interstitial');
  }

  async showRewarded(): Promise<boolean> {
    // No ad to show is not a reward: the play screen says no ad could be shown.
    if (!(await this.ready('rewarded'))) throw new Error('No rewarded ad loaded');
    return this.present('rewarded');
  }

  private load(kind: Kind): void {
    const options = { adId: this.units[kind], isTesting: this.isTesting };
    const prepare =
      kind === 'interstitial'
        ? this.api.prepareInterstitial(options)
        : this.api.prepareRewardVideoAd(options);
    this.loads[kind] = prepare.then(
      () => true,
      (error: unknown) => {
        this.onError(error);
        return false;
      },
    );
  }

  /** Whether an ad of this kind is loaded, waiting for it a little if it is still loading. */
  private async ready(kind: Kind): Promise<boolean> {
    if (this.loads[kind] === null) this.load(kind);
    const load = this.loads[kind]!;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>((resolve) => {
      timer = setTimeout(() => resolve('late'), this.waitMs);
    });
    const loaded = await Promise.race([load, late]);
    clearTimeout(timer);
    // Still loading: it may be ready next time. Failed: load again next time.
    if (loaded === false) this.loads[kind] = null;
    return loaded === true;
  }

  /**
   * Shows the loaded ad and resolves when it has gone: with whether the reward
   * was earned (always false for an interstitial). A rewarded ad that could not
   * show rejects. The next ad loads behind it.
   */
  private async present(kind: Kind): Promise<boolean> {
    this.loads[kind] = null;
    const [dismissed, failedToShow] =
      kind === 'interstitial'
        ? [ADMOB_EVENTS.interstitialDismissed, ADMOB_EVENTS.interstitialFailedToShow]
        : [ADMOB_EVENTS.rewardedDismissed, ADMOB_EVENTS.rewardedFailedToShow];
    // Set by the plugin's answers, which come while this waits.
    const outcome: { earned: boolean; failure: Error | null } = { earned: false, failure: null };
    let finish: () => void = () => undefined;
    const gone = new Promise<void>((resolve) => (finish = resolve));
    const fail = (error: unknown): void => {
      outcome.failure ??= error instanceof Error ? error : new Error(String(error));
      this.onError(error);
      finish();
    };
    const handles = await Promise.all([
      this.api.addListener(dismissed, () => finish()),
      this.api.addListener(failedToShow, () => fail(new Error(`The ${kind} ad failed to show`))),
      ...(kind === 'rewarded'
        ? [this.api.addListener(ADMOB_EVENTS.rewarded, () => (outcome.earned = true))]
        : []),
    ]);
    if (kind === 'interstitial') {
      this.api.showInterstitial().catch(fail);
    } else {
      // Resolves only when the reward is earned; the dismissal ends the ad either way.
      this.api.showRewardVideoAd().then(() => (outcome.earned = true), fail);
    }
    await gone;
    await Promise.all(handles.map((handle) => handle.remove().catch(this.onError)));
    this.load(kind);
    if (outcome.failure !== null && !outcome.earned && kind === 'rewarded') throw outcome.failure;
    return outcome.earned;
  }
}
