// The licence files as the packages ship them, read at build time: what the
// Credits screen shows is what the build bundles (docs/ARCHITECTURE.md, Credits).
import geist from '../../node_modules/@fontsource-variable/geist/LICENSE?raw';
import instrumentSerif from '../../node_modules/@fontsource/instrument-serif/LICENSE?raw';
import admob from '../../node_modules/@capacitor-community/admob/LICENSE?raw';
import capacitorCore from '../../node_modules/@capacitor/core/LICENSE?raw';
import capacitorHaptics from '../../node_modules/@capacitor/haptics/LICENSE?raw';
import capacitorIos from '../../node_modules/@capacitor/ios/LICENSE?raw';
import capacitorPreferences from '../../node_modules/@capacitor/preferences/LICENSE?raw';
import capacitorStatusBar from '../../node_modules/@capacitor/status-bar/LICENSE?raw';

export interface Credit {
  readonly name: string;
  /** The licence's short name. */
  readonly licence: string;
  /** The licence file, copyright notice included. */
  readonly text: string;
}

const OFL = 'SIL Open Font License 1.1';

/** The fonts the game bundles (docs/DESIGN.md): their licence asks to travel with them. */
export const FONTS: readonly Credit[] = [
  { name: 'Instrument Serif', licence: OFL, text: instrumentSerif },
  { name: 'Geist', licence: OFL, text: geist },
];

/** The libraries in the build: Capacitor and its plugins, in the iOS app. */
export const SOFTWARE: readonly Credit[] = [
  { name: 'Capacitor', licence: 'MIT', text: capacitorCore },
  { name: 'Capacitor iOS', licence: 'MIT', text: capacitorIos },
  { name: 'Capacitor Haptics', licence: 'MIT', text: capacitorHaptics },
  { name: 'Capacitor Preferences', licence: 'MIT', text: capacitorPreferences },
  { name: 'Capacitor Status Bar', licence: 'MIT', text: capacitorStatusBar },
  { name: 'Capacitor AdMob (capacitor-community)', licence: 'MIT', text: admob },
];
