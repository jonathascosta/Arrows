/**
 * Every player-facing string, by key, so a second language is a second table.
 * Placeholders are `{name}`.
 */
const en = {
  'app.name': 'Arrows',
  'title.level': 'Level {n}',
  'title.daily': 'Daily · {date}',
  'tier.easy': 'Easy',
  'tier.medium': 'Medium',
  'tier.hard': 'Hard',
  'tier.superHard': 'Super Hard',
  'nav.back': 'Back to home',
  'nav.home': 'Home',
  'home.levels': 'Levels',
  'home.play': 'Play',
  'home.streak': 'Streak {n}',
  'home.streakLabel': 'Win streak: {n}',
  'home.menu': 'Puzzle picker',
  'home.path': 'Level path',
  'home.done': 'Level {n}, done',
  'home.current': 'Level {n}, next to play',
  'home.ahead': 'Level {n}, ahead',
  'home.daily': 'Daily',
  'home.dailyNote': 'Today’s board',
  'home.league': 'League',
  'home.leagueTitle': 'Bronze',
  'home.leagueNote': 'Opens soon',
  'home.event': 'Event',
  'home.eventNote': 'A drawing board',
  'hud.chances': '{n} of {total} chances left',
  'hud.timer': 'Time {time}',
  'tools.grid': 'Grid',
  'tools.hint': 'Hint',
  'tools.hintShown': 'Hint shown',
  'tools.ad': 'AD',
  'tools.adNote': '(plays an ad)',
  'board.label.one': 'Board, 1 arrow left. Pinch or scroll to zoom, drag to move.',
  'board.label.other': 'Board, {n} arrows left. Pinch or scroll to zoom, drag to move.',
  'status.blocked.one': 'Blocked. 1 chance left.',
  'status.blocked.other': 'Blocked. {n} chances left.',
  'status.hint': 'Try the highlighted arrow.',
  'status.noHint': 'No free arrow right now.',
  'won.title': 'Solved',
  'won.summary': '{time} · {chances} of {total} chances left.',
  'won.firstTry': 'First try. Win streak is now {n}.',
  'won.streakOver': 'Not on the first try, so the streak starts again.',
  'won.newBest': 'New best time!',
  'won.best': 'Best {time}.',
  'won.next': 'Next level',
  'won.again': 'Play again',
  'lost.title': 'Out of chances',
  'lost.body': 'Retry plays the same puzzle again, with {total} fresh chances and the timer reset.',
  'lost.retry': 'Retry',
} as const;

export type StringKey = keyof typeof en;

/** Keys that come in `.one` and `.other` forms, chosen by count. */
type PluralBase<K> = K extends `${infer Base}.other` ? Base : never;
export type PluralKey = PluralBase<StringKey>;

const plurals = new Intl.PluralRules('en');

export function t(key: StringKey, params: Readonly<Record<string, string | number>> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** A string that depends on a count: `{n}` is the count, the form follows English plural rules. */
export function tn(
  key: PluralKey,
  n: number,
  params: Readonly<Record<string, string | number>> = {},
): string {
  const form = plurals.select(n) === 'one' ? 'one' : 'other';
  return t(`${key}.${form}`, { ...params, n });
}

const SMALL_NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/** Small counts in words, as running text prefers ("three fresh chances"); digits from 11. */
export function spellOut(n: number): string {
  return SMALL_NUMBERS[n] ?? String(n);
}

/** `2026-10-03` as `Sat 3 Oct`, the way the home screen names a day. */
export function formatDayShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  // Parts, not format(): engines disagree on the comma after the weekday.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

/** `2026-10-02` as `Oct 2, 2026`. */
export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Milliseconds as `mm:ss`, or `h:mm:ss` from an hour on. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}
