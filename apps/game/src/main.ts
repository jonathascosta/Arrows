import './styles.css';
import { parseRoute, routeSearch } from './route.ts';
import { PlayScreen } from './screens/play.ts';
import { DEFAULT_THEME } from './theme/default.ts';
import { applyTheme } from './theme/theme.ts';

applyTheme(DEFAULT_THEME, document.documentElement);

const root = document.getElementById('app');
if (root === null) throw new Error('index.html has no #app element');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const screen = new PlayScreen(root, {
  theme: DEFAULT_THEME,
  now: () => performance.now(),
  reducedMotion: () => reducedMotion.matches,
  navigate: (ref) => {
    history.pushState(null, '', routeSearch(ref));
    screen.open(ref);
  },
  // T3 replaces this with the home screen.
  backHref: 'dev.html',
});

screen.open(parseRoute(location.search));
window.addEventListener('popstate', () => screen.open(parseRoute(location.search)));
