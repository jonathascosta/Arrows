/** Build-time settings (`VITE_*`), set by the TestFlight job; see docs/ARCHITECTURE.md, iOS. */
interface ImportMetaEnv {
  /** The owner's AdMob interstitial unit; Google's test unit when unset. */
  readonly VITE_ADMOB_INTERSTITIAL_ID?: string;
  /** The owner's AdMob rewarded unit; Google's test unit when unset. */
  readonly VITE_ADMOB_REWARDED_ID?: string;
}
