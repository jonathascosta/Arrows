import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource-variable/geist/wght.css';
import './styles.css';
import { App } from './app.ts';
import { DAILY_KEY } from './persistence/daily.ts';
import { PROGRESS_KEY } from './persistence/progress.ts';
import { browserStore } from './persistence/store.ts';
import { localDateKey } from './daily/days.ts';
import { DEFAULT_THEME } from './theme/default.ts';
import { applyTheme } from './theme/theme.ts';

applyTheme(DEFAULT_THEME, document.documentElement);

const root = document.getElementById('app');
if (root === null) throw new Error('index.html has no #app element');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const app = new App(root, {
  theme: DEFAULT_THEME,
  store: browserStore(),
  now: () => performance.now(),
  reducedMotion: () => reducedMotion.matches,
  today: () => localDateKey(),
  pushUrl: (url) => history.pushState(null, '', url),
  // An empty search would keep the current one: the home screen is './'.
  replaceUrl: (url) => history.replaceState(null, '', url === '' ? './' : url),
  pickerHref: 'dev.html',
});

app.show(location.search);
window.addEventListener('popstate', () => app.show(location.search));
// A page restored from the back-forward cache, or progress saved in another
// tab, would otherwise show an out-of-date home screen.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) app.refresh();
});
window.addEventListener('storage', (event) => {
  if (event.key === null || event.key === PROGRESS_KEY || event.key === DAILY_KEY) app.refresh();
});
