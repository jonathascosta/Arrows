import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource-variable/geist/wght.css';
import './styles.css';
import { App } from './app.ts';
import { browserStore } from './persistence/store.ts';
import { localDateKey } from './route.ts';
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
  pickerHref: 'dev.html',
});

app.show(location.search);
window.addEventListener('popstate', () => app.show(location.search));
