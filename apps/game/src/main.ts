import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource-variable/geist/wght.css';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { App } from './app.ts';
import { DAILY_KEY } from './persistence/daily.ts';
import { EVENTS_KEY } from './persistence/events.ts';
import { LEAGUE_KEY } from './persistence/league.ts';
import { PROGRESS_KEY } from './persistence/progress.ts';
import { webPlatform } from './platform/platform.ts';
import { WebAudioSounds } from './platform/sounds.ts';
import { applyTextScale, preferredTextScale } from './platform/textSize.ts';
import { LOCALE_TAGS, localeFor, setLocale } from './strings.ts';
import { DEFAULT_THEME } from './theme/default.ts';
import { applyTheme } from './theme/theme.ts';

// The device's language, when the game speaks it (docs/PRODUCT.md, Languages);
// before anything is drawn or named. Old web views have only `language`.
const languages = (navigator.languages as readonly string[] | undefined) ?? [navigator.language];
const locale = localeFor(languages);
setLocale(locale);
document.documentElement.lang = LOCALE_TAGS[locale];

applyTheme(DEFAULT_THEME, document.documentElement);
// The phone's text size, again whenever the player comes back (it may have changed).
applyTextScale(document, preferredTextScale(document));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible')
    applyTextScale(document, preferredTextScale(document));
});

const root = document.getElementById('app');
if (root === null) throw new Error('index.html has no #app element');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The iOS app keeps records in Preferences and shows AdMob ads; its module loads only there.
const platform = Capacitor.isNativePlatform()
  ? await (await import('./platform/native.ts')).nativePlatform(document)
  : webPlatform(document);

const app = new App(root, {
  theme: DEFAULT_THEME,
  store: platform.store,
  now: () => performance.now(),
  reducedMotion: () => reducedMotion.matches,
  clock: () => new Date(),
  pushUrl: (url) => history.pushState(null, '', url),
  // An empty search would keep the current one: the home screen is './'.
  replaceUrl: (url) => history.replaceState(null, '', url === '' ? './' : url),
  pickerHref: 'dev.html',
  // No ads on the web; the puzzle picker can turn on test ads (docs/PRODUCT.md, Monetization).
  ads: platform.ads,
  haptics: platform.haptics,
  privacy: platform.privacy,
  sounds: new WebAudioSounds(),
});

app.show(location.search);
window.addEventListener('popstate', () => app.show(location.search));
// A page restored from the back-forward cache, or progress saved in another
// tab, would otherwise show an out-of-date home screen.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) app.refresh();
});
// Settings need no refresh: the cues read them each time they play.
window.addEventListener('storage', (event) => {
  const keys = [PROGRESS_KEY, DAILY_KEY, LEAGUE_KEY, EVENTS_KEY];
  if (event.key === null || keys.includes(event.key)) app.refresh();
});
