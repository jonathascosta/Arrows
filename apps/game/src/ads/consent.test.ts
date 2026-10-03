import { describe, expect, it } from 'vitest';
import { AdConsent } from './consent.ts';
import type { ConsentApi, ConsentInfo } from './consent.ts';
// The plugin's iOS source as installed, with the repository's patch applied.
import pluginSource from '../../node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift?raw';

/** The plugin as the flow sees it, recording each call in order. */
class FakeConsent implements ConsentApi {
  readonly calls: string[] = [];
  info: ConsentInfo = {
    status: 'NOT_REQUIRED',
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  };
  /** What the form leaves behind once the player has answered. */
  afterForm: Partial<ConsentInfo> = {};
  tracking = 'notDetermined';
  failInfo = false;
  failForm = false;

  requestConsentInfo(): Promise<ConsentInfo> {
    this.calls.push('info');
    return this.failInfo ? Promise.reject(new Error('offline')) : Promise.resolve(this.info);
  }

  showConsentForm(): Promise<ConsentInfo> {
    this.calls.push('form');
    if (this.failForm) return Promise.reject(new Error('No ViewController'));
    this.info = { ...this.info, ...this.afterForm };
    return Promise.resolve(this.info);
  }

  showPrivacyOptionsForm(): Promise<void> {
    this.calls.push('privacy');
    return Promise.resolve();
  }

  trackingAuthorizationStatus(): Promise<{ status: string }> {
    this.calls.push('tracking?');
    return Promise.resolve({ status: this.tracking });
  }

  requestTrackingAuthorization(): Promise<void> {
    this.calls.push('tracking');
    this.tracking = 'denied';
    return Promise.resolve();
  }

  initialize(): Promise<void> {
    this.calls.push('start');
    return Promise.resolve();
  }
}

describe('AdConsent', () => {
  it('asks for consent where it is required, then tracking, then starts the SDK', async () => {
    const api = new FakeConsent();
    api.info = { ...api.info, status: 'REQUIRED', isConsentFormAvailable: true };
    api.afterForm = { status: 'OBTAINED', privacyOptionsRequirementStatus: 'REQUIRED' };
    const consent = new AdConsent(api);
    await consent.ready();
    expect(api.calls).toEqual(['info', 'form', 'tracking?', 'tracking', 'start']);
    // Once is enough: every later load finds the SDK started.
    await consent.ready();
    expect(api.calls).toHaveLength(5);
    // The player can change their choices from Settings.
    expect(consent.privacyOptionsRequired).toBe(true);
    await consent.showPrivacyOptions();
    expect(api.calls.at(-1)).toBe('privacy');
  });

  it('shows no form where none is required, and no tracking prompt once answered', async () => {
    const api = new FakeConsent();
    api.tracking = 'authorized';
    const consent = new AdConsent(api);
    await consent.ready();
    expect(api.calls).toEqual(['info', 'tracking?', 'start']);
    expect(consent.privacyOptionsRequired).toBe(false);
  });

  it('requests no ads while the player’s choices allow none, and asks again later', async () => {
    const api = new FakeConsent();
    api.info = { ...api.info, status: 'REQUIRED', isConsentFormAvailable: true };
    api.afterForm = { canRequestAds: false };
    const consent = new AdConsent(api);
    await expect(consent.ready()).rejects.toThrow('allow no ads');
    expect(api.calls).not.toContain('start');
    // The next time an ad is needed, the message shows again.
    api.afterForm = { status: 'OBTAINED', canRequestAds: true };
    await consent.ready();
    expect(api.calls.filter((call) => call === 'form')).toHaveLength(2);
    expect(api.calls.at(-1)).toBe('start');
  });

  it('requests no ads when the consent check fails, and checks again when an ad is needed', async () => {
    const api = new FakeConsent();
    api.failInfo = true;
    const consent = new AdConsent(api);
    await expect(consent.ready()).rejects.toThrow('offline');
    expect(api.calls).toEqual(['info']);
    api.failInfo = false;
    await consent.ready();
    expect(api.calls).toEqual(['info', 'info', 'tracking?', 'tracking', 'start']);
  });

  it('keeps what the check said when the form cannot show', async () => {
    const api = new FakeConsent();
    api.info = {
      ...api.info,
      status: 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: false,
    };
    api.failForm = true;
    const errors: unknown[] = [];
    await expect(new AdConsent(api, (error) => errors.push(error)).ready()).rejects.toThrow(
      'allow no ads',
    );
    expect(errors).toHaveLength(1);
    expect(api.calls).not.toContain('start');
  });

  it('relies on the patched plugin, whose forms can show before the SDK starts', () => {
    // patches/@capacitor-community__admob@8.1.0.patch: without it the plugin wires its
    // consent forms only in `initialize`, and a form shown first fails.
    expect(pluginSource).toMatch(
      /override public func load\(\) \{\s*self\.consentExecutor\.plugin = self/,
    );
  });
});
