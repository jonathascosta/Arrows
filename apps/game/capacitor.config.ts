import type { CapacitorConfig } from '@capacitor/cli';
import { DEFAULT_THEME } from './src/theme/default.ts';

/**
 * The iOS wrapper (docs/ARCHITECTURE.md, iOS). The app id and name are the
 * ones docs/PRODUCT.md records; the id is fixed for good with the first upload
 * to App Store Connect.
 */
const config: CapacitorConfig = {
  appId: 'net.jonathas.arrows',
  appName: 'Arrows',
  webDir: 'dist',
  ios: {
    // The page runs under the status bar and the home indicator and keeps clear
    // of them with the CSS safe-area insets, so the paper colour fills the screen.
    contentInset: 'never',
    backgroundColor: DEFAULT_THEME.colors.background,
    // The text screens (Credits, the league, a calendar in large text) scroll the
    // page, so the web view keeps its scrolling. Capacitor turns its bounce off,
    // so the board's screen, which fits the window, never moves.
    scrollEnabled: true,
  },
};

export default config;
