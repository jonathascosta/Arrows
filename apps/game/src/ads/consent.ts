/**
 * What the consent flow needs of the AdMob plugin (`@capacitor-community/admob`):
 * Google's User Messaging Platform (UMP), Apple's tracking prompt (App Tracking
 * Transparency) and the SDK's start.
 */
export interface ConsentApi {
  requestConsentInfo(): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  trackingAuthorizationStatus(): Promise<{ status: string }>;
  requestTrackingAuthorization(): Promise<void>;
  initialize(): Promise<void>;
}

/** The plugin's `AdmobConsentInfo`. */
export interface ConsentInfo {
  /** `REQUIRED`, `NOT_REQUIRED`, `OBTAINED` or `UNKNOWN`. */
  readonly status: string;
  readonly isConsentFormAvailable?: boolean;
  readonly canRequestAds: boolean;
  /** `REQUIRED` where the player must be able to change their choices later. */
  readonly privacyOptionsRequirementStatus: string;
}

/**
 * Asks for the player's choices about ads before any ad is requested
 * (docs/PRODUCT.md, Monetization), in the order Google and Apple ask for:
 *
 * 1. Google's consent message, where the law requires one (the EEA, the UK,
 *    Switzerland and some US states). The owner writes it in the AdMob console;
 *    it can include an explainer that shows Apple's tracking prompt itself. (The
 *    plugin is patched so that its forms can show before the SDK starts.)
 * 2. Apple's tracking prompt, if the message did not show it already.
 * 3. The SDK starts, unless the player's choices allow no ads at all.
 *
 * The game never waits for any of it. If the consent check fails (no network),
 * no ad is requested: the flow runs again the next time an ad is needed.
 */
export class AdConsent {
  private readonly api: ConsentApi;
  private readonly onError: (error: unknown) => void;
  private privacyOptions = false;
  private attempt: Promise<void> | null = null;

  constructor(api: ConsentApi, onError: (error: unknown) => void = () => undefined) {
    this.api = api;
    this.onError = onError;
  }

  /**
   * Resolves once ads may be requested; rejects when they may not yet. The flow
   * runs on the first call, and again on the next call after one that failed.
   */
  ready(): Promise<void> {
    this.attempt ??= this.run().catch((error: unknown) => {
      this.attempt = null;
      throw error;
    });
    return this.attempt;
  }

  private async run(): Promise<void> {
    // Without an answer from Google there are no choices to go by: no ads, for now.
    let info = await this.api.requestConsentInfo();
    if (info.status === 'REQUIRED' && info.isConsentFormAvailable === true) {
      try {
        info = await this.api.showConsentForm();
      } catch (error) {
        // What the check said stands: no ads if they needed this answer.
        this.onError(error);
      }
    }
    this.privacyOptions = info.privacyOptionsRequirementStatus === 'REQUIRED';
    try {
      const { status } = await this.api.trackingAuthorizationStatus();
      if (status === 'notDetermined') await this.api.requestTrackingAuthorization();
    } catch (error) {
      this.onError(error);
    }
    if (!info.canRequestAds) throw new Error('The player’s choices allow no ads');
    await this.api.initialize();
  }

  /** Whether Settings must offer the player a way back to their choices. */
  get privacyOptionsRequired(): boolean {
    return this.privacyOptions;
  }

  /** Google's form to change the choices, from Settings. */
  async showPrivacyOptions(): Promise<void> {
    try {
      await this.api.showPrivacyOptionsForm();
    } catch (error) {
      this.onError(error);
    }
  }
}
