import { describe, expect, it } from 'vitest';
import { AdConsent } from './consent.ts';
import type { ConsentApi, ConsentInfo } from './consent.ts';

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

  requestConsentInfo(): Promise<ConsentInfo> {
    this.calls.push('info');
    return this.failInfo ? Promise.reject(new Error('offline')) : Promise.resolve(this.info);
  }

  showConsentForm(): Promise<ConsentInfo> {
    this.calls.push('form');
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
    await consent.start();
    expect(api.calls).toEqual(['info', 'form', 'tracking?', 'tracking', 'start']);
    // The player can change their choices from Settings.
    expect(consent.privacyOptionsRequired).toBe(true);
    await consent.showPrivacyOptions();
    expect(api.calls.at(-1)).toBe('privacy');
  });

  it('shows no form where none is required, and no tracking prompt once answered', async () => {
    const api = new FakeConsent();
    api.tracking = 'authorized';
    const consent = new AdConsent(api);
    await consent.start();
    expect(api.calls).toEqual(['info', 'tracking?', 'start']);
    expect(consent.privacyOptionsRequired).toBe(false);
  });

  it('requests no ads when the player’s choices allow none', async () => {
    const api = new FakeConsent();
    api.info = { ...api.info, status: 'REQUIRED', isConsentFormAvailable: true };
    api.afterForm = { canRequestAds: false };
    await expect(new AdConsent(api).start()).rejects.toThrow('allow no ads');
    expect(api.calls).not.toContain('start');
  });

  it('starts the SDK on the choices it kept when the consent check fails', async () => {
    const api = new FakeConsent();
    api.failInfo = true;
    const errors: unknown[] = [];
    const consent = new AdConsent(api, (error) => errors.push(error));
    await consent.start();
    expect(api.calls).toEqual(['info', 'tracking?', 'tracking', 'start']);
    expect(errors).toHaveLength(1);
    expect(consent.privacyOptionsRequired).toBe(false);
  });
});
