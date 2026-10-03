import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource-variable/geist/wght.css';
import './styles.css';
import { LOCALE_TAGS, localeFor, setLocale, t } from './strings.ts';
import { DEFAULT_THEME } from './theme/default.ts';
import { applyTheme } from './theme/theme.ts';
import { iconSpan } from './ui/dom.ts';

/**
 * The privacy policy page (privacy.html): the text is the page's own, in both
 * languages; this puts the player's language first and themes the page.
 */
applyTheme(DEFAULT_THEME, document.documentElement);
const languages = (navigator.languages as readonly string[] | undefined) ?? [navigator.language];
const locale = localeFor(languages);
setLocale(locale);
document.documentElement.lang = LOCALE_TAGS[locale];

const english = document.getElementById('policy-en');
const portuguese = document.getElementById('policy-pt');
if (locale === 'pt' && english !== null && portuguese !== null) english.before(portuguese);
document.title = `${t('app.name')} · ${t('settings.privacyPolicy')}`;

// Back to the game when Settings opened the page (PRIVACY_HREF); opened on its own
// (straight from the web build), it has no game to go back to.
const back = document.querySelector<HTMLAnchorElement>('.doc .back');
if (back !== null) {
  back.append(iconSpan(document, DEFAULT_THEME.icons.back, 'icon'));
  back.setAttribute('aria-label', t('nav.back'));
  back.hidden = new URLSearchParams(location.search).get('from') !== 'game';
}
