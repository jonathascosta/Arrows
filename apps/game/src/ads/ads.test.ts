import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../persistence/store.ts';
import { ADS_KEY, NO_ADS, adsFor } from './ads.ts';
import { DebugAds } from './debug.ts';

describe('NO_ADS', () => {
  it('shows nothing and grants every reward at once', async () => {
    await expect(NO_ADS.showInterstitial()).resolves.toBeUndefined();
    await expect(NO_ADS.showRewarded()).resolves.toBe(true);
  });
});

describe('adsFor', () => {
  it('turns the test ads on only when the setting asks for them', () => {
    const store = new MemoryStore();
    expect(adsFor(store, document)).toBe(NO_ADS);
    store.setItem(ADS_KEY, 'yes');
    expect(adsFor(store, document)).toBe(NO_ADS);
    store.setItem(ADS_KEY, 'test');
    expect(adsFor(store, document)).toBeInstanceOf(DebugAds);
  });

  it('gives the platform’s ads when the test ads are off', () => {
    const store = new MemoryStore();
    const network = {
      showInterstitial: () => Promise.resolve(),
      showRewarded: () => Promise.resolve(true),
    };
    expect(adsFor(store, document, network)).toBe(network);
    store.setItem(ADS_KEY, 'test');
    expect(adsFor(store, document, network)).toBeInstanceOf(DebugAds);
  });
});

describe('DebugAds', () => {
  function setup(): { ads: DebugAds; app: HTMLElement; hint: HTMLButtonElement } {
    const hint = document.createElement('button');
    const app = document.createElement('div');
    app.append(hint);
    document.body.replaceChildren(app);
    hint.focus();
    return { ads: new DebugAds(document), app, hint };
  }

  const buttons = (ads: DebugAds): HTMLButtonElement[] => [
    ...ads.element.querySelectorAll<HTMLButtonElement>('button'),
  ];

  it('shows a card for the interstitial, with the page out of reach until it closes', async () => {
    const { ads, app, hint } = setup();
    let closed = false;
    const shown = ads.showInterstitial().then(() => (closed = true));
    expect(ads.element.isConnected).toBe(true);
    expect(ads.element.hidden).toBe(false);
    expect(ads.element.getAttribute('role')).toBe('dialog');
    expect(ads.element.dataset.kind).toBe('interstitial');
    expect(ads.element.querySelector('h2')?.textContent).toBe('Test ad');
    expect(ads.element.querySelector('p')?.textContent).toBe(
      'An interstitial ad would show here, between the board and its score.',
    );
    expect(buttons(ads).map((button) => button.textContent)).toEqual(['Close ad']);
    expect(document.activeElement).toBe(buttons(ads)[0]);
    expect(app.hasAttribute('inert')).toBe(true);
    expect(closed).toBe(false);

    buttons(ads)[0]!.click();
    await shown;
    expect(closed).toBe(true);
    expect(ads.element.hidden).toBe(true);
    expect(app.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(hint);
    expect(ads.element.dataset.interstitials).toBe('1');
    expect(ads.element.dataset.rewarded).toBe('0');
  });

  it('earns the reward when watched to the end, and none when closed early', async () => {
    const { ads } = setup();
    const watched = ads.showRewarded();
    expect(ads.element.dataset.kind).toBe('rewarded');
    expect(buttons(ads).map((button) => button.textContent)).toEqual([
      'Watch to the end',
      'Close without the reward',
    ]);
    buttons(ads)[0]!.click();
    await expect(watched).resolves.toBe(true);

    const skipped = ads.showRewarded();
    buttons(ads)[1]!.click();
    await expect(skipped).resolves.toBe(false);
    expect(ads.element.dataset.rewarded).toBe('2');
    expect(ads.element.dataset.interstitials).toBe('0');
  });

  it('shows one ad at a time: another asked for meanwhile earns nothing', async () => {
    const { ads } = setup();
    const first = ads.showRewarded();
    await expect(ads.showRewarded()).resolves.toBe(false);
    await expect(ads.showInterstitial()).resolves.toBeUndefined();
    expect(ads.element.dataset.rewarded).toBe('1');
    expect(ads.element.dataset.interstitials).toBe('0');
    buttons(ads)[0]!.click();
    await expect(first).resolves.toBe(true);
  });

  it('leaves alone what was out of reach before it showed', async () => {
    const { ads } = setup();
    const sheet = document.createElement('div');
    sheet.toggleAttribute('inert', true);
    document.body.append(sheet);
    const shown = ads.showInterstitial();
    buttons(ads)[0]!.click();
    await shown;
    expect(sheet.hasAttribute('inert')).toBe(true);
  });
});
