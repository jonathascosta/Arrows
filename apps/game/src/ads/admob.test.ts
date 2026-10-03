import { InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMOB_EVENTS, AdMobAds, TEST_AD_UNITS } from './admob.ts';
import type { AdMobApi, ListenerHandle } from './admob.ts';

/** Promises the test settles by hand. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** The AdMob plugin as the provider sees it: loads and shows that the test drives. */
class FakeAdMob implements AdMobApi {
  readonly prepared: { kind: string; adId: string }[] = [];
  readonly loads: ReturnType<typeof deferred<unknown>>[] = [];
  readonly shows: string[] = [];
  readonly listeners = new Map<string, Set<() => void>>();
  rewardedShow = deferred<unknown>();
  interstitialShow: Promise<void> = Promise.resolve();

  private prepare(kind: string, options: { adId: string }): Promise<unknown> {
    this.prepared.push({ kind, ...options });
    const load = deferred<unknown>();
    this.loads.push(load);
    return load.promise;
  }

  prepareInterstitial(options: { adId: string }): Promise<unknown> {
    return this.prepare('interstitial', options);
  }

  prepareRewardVideoAd(options: { adId: string }): Promise<unknown> {
    return this.prepare('rewarded', options);
  }

  showInterstitial(): Promise<void> {
    this.shows.push('interstitial');
    return this.interstitialShow;
  }

  showRewardVideoAd(): Promise<unknown> {
    this.shows.push('rewarded');
    return this.rewardedShow.promise;
  }

  addListener(eventName: string, listener: () => void): Promise<ListenerHandle> {
    const set = this.listeners.get(eventName) ?? new Set();
    set.add(listener);
    this.listeners.set(eventName, set);
    return Promise.resolve({
      remove: () => {
        set.delete(listener);
        return Promise.resolve();
      },
    });
  }

  emit(eventName: string): void {
    for (const listener of [...(this.listeners.get(eventName) ?? [])]) listener();
  }

  get listening(): number {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }

  /** Finishes every load still pending. */
  loadAll(): void {
    for (const load of this.loads.splice(0)) load.resolve({});
  }
}

describe('AdMobAds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('listens to the plugin’s own event names', () => {
    expect(ADMOB_EVENTS).toEqual({
      interstitialDismissed: InterstitialAdPluginEvents.Dismissed,
      interstitialFailedToShow: InterstitialAdPluginEvents.FailedToShow,
      rewardedDismissed: RewardAdPluginEvents.Dismissed,
      rewardedFailedToShow: RewardAdPluginEvents.FailedToShow,
      rewarded: RewardAdPluginEvents.Rewarded,
    });
  });

  it('loads both ads ahead with the units it is given, once the SDK has started', async () => {
    const api = new FakeAdMob();
    const started = deferred<undefined>();
    new AdMobAds(api, { units: TEST_AD_UNITS, started: started.promise }).preload();
    await settle();
    expect(api.prepared).toEqual([]);
    started.resolve(undefined);
    await settle();
    // Never the plugin's `isTesting`, which would swap in its own (partly Android) units.
    expect(api.prepared).toEqual([
      { kind: 'interstitial', adId: TEST_AD_UNITS.interstitial },
      { kind: 'rewarded', adId: TEST_AD_UNITS.rewarded },
    ]);
    const own = new FakeAdMob();
    new AdMobAds(own, { units: { interstitial: 'mine/1', rewarded: 'mine/2' } }).preload();
    await settle();
    expect(own.prepared.map((load) => load.adId)).toEqual(['mine/1', 'mine/2']);
  });

  it('loads nothing when the SDK did not start', async () => {
    const errors: unknown[] = [];
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, {
      units: TEST_AD_UNITS,
      started: Promise.reject(new Error('no SDK')),
      onError: (error) => errors.push(error),
    });
    await expect(ads.showRewarded()).rejects.toThrow('No rewarded ad loaded');
    await ads.showInterstitial();
    expect(api.prepared).toEqual([]);
    expect(api.shows).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('shows the interstitial and resolves only when it is dismissed, then loads the next', async () => {
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS });
    ads.preload();
    await settle();
    api.loadAll();
    let closed = false;
    const shown = ads.showInterstitial().then(() => (closed = true));
    await settle();
    expect(api.shows).toEqual(['interstitial']);
    expect(closed).toBe(false);
    api.emit(ADMOB_EVENTS.interstitialDismissed);
    await shown;
    expect(api.listening).toBe(0);
    // The next interstitial is already loading.
    expect(api.prepared.map((load) => load.kind)).toEqual([
      'interstitial',
      'rewarded',
      'interstitial',
    ]);
  });

  it('goes without the interstitial when it is not loaded in time, and keeps loading it', async () => {
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS, waitMs: 1000 });
    const shown = ads.showInterstitial();
    await vi.advanceTimersByTimeAsync(1000);
    await shown;
    expect(api.shows).toEqual([]);
    expect(api.prepared).toHaveLength(1);
    // Loaded meanwhile: the next board shows it, without a second load.
    api.loadAll();
    const next = ads.showInterstitial();
    await settle();
    expect(api.shows).toEqual(['interstitial']);
    api.emit(ADMOB_EVENTS.interstitialDismissed);
    await next;
    expect(api.prepared.map((load) => load.kind)).toEqual(['interstitial', 'interstitial']);
  });

  it('tries a failed load once more within the same wait', async () => {
    const errors: unknown[] = [];
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS, onError: (e) => errors.push(e) });
    ads.preload();
    await settle();
    // The ad loaded ahead found no fill; the hint asks for a new one and gets it.
    api.loads.splice(0, 2).forEach((load) => load.reject(new Error('no fill')));
    const hint = ads.showRewarded();
    await settle();
    api.loadAll();
    await settle();
    expect(api.shows).toEqual(['rewarded']);
    api.emit(ADMOB_EVENTS.rewarded);
    api.emit(ADMOB_EVENTS.rewardedDismissed);
    await expect(hint).resolves.toBe(true);
    expect(errors).toHaveLength(2);
  });

  it('goes on after an interstitial that failed to load twice, or failed to show', async () => {
    const errors: unknown[] = [];
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS, onError: (e) => errors.push(e) });
    const first = ads.showInterstitial();
    await settle();
    api.loads.shift()!.reject(new Error('no fill'));
    await settle();
    api.loads.shift()!.reject(new Error('no fill again'));
    await first;
    expect(api.shows).toEqual([]);
    expect(api.prepared).toHaveLength(2);
    // The next board loads anew; this one is shown but fails to show.
    const second = ads.showInterstitial();
    await settle();
    api.loadAll();
    await settle();
    api.emit(ADMOB_EVENTS.interstitialFailedToShow);
    await second;
    expect(api.shows).toEqual(['interstitial']);
    expect(errors).toHaveLength(3);
    expect(api.listening).toBe(0);
  });

  it('earns the reward only when the rewarded ad says so, once it is dismissed', async () => {
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS });
    ads.preload();
    await settle();
    api.loadAll();

    // Watched to the end: the reward comes, then the dismissal.
    const watched = ads.showRewarded();
    await settle();
    api.emit(ADMOB_EVENTS.rewarded);
    api.emit(ADMOB_EVENTS.rewardedDismissed);
    await expect(watched).resolves.toBe(true);

    // Closed early: dismissed without a reward, and the show call never answers.
    api.rewardedShow = deferred<unknown>();
    await settle();
    api.loadAll();
    const skipped = ads.showRewarded();
    await settle();
    api.emit(ADMOB_EVENTS.rewardedDismissed);
    await expect(skipped).resolves.toBe(false);

    // The show call's own answer counts as the reward too.
    api.rewardedShow = deferred<unknown>();
    await settle();
    api.loadAll();
    const answered = ads.showRewarded();
    await settle();
    api.rewardedShow.resolve({ type: 'hint', amount: 1 });
    await settle();
    api.emit(ADMOB_EVENTS.rewardedDismissed);
    await expect(answered).resolves.toBe(true);
    expect(api.listening).toBe(0);
  });

  it('rejects a rewarded ad that is not loaded in time or fails to show', async () => {
    const api = new FakeAdMob();
    const ads = new AdMobAds(api, { units: TEST_AD_UNITS, waitMs: 1000 });
    const late = ads.showRewarded();
    const expectation = expect(late).rejects.toThrow('No rewarded ad loaded');
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;

    await settle();
    api.loadAll();
    const failing = ads.showRewarded();
    await settle();
    api.emit(ADMOB_EVENTS.rewardedFailedToShow);
    await expect(failing).rejects.toThrow('The rewarded ad failed to show');

    api.rewardedShow = deferred<unknown>();
    await settle();
    api.loadAll();
    const refused = ads.showRewarded();
    await settle();
    api.rewardedShow.reject(new Error('An ad is already showing'));
    await expect(refused).rejects.toThrow('An ad is already showing');
    expect(api.listening).toBe(0);
  });
});
