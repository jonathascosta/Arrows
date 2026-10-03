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
  'nav.backCalendar': 'Back to the calendar',
  'nav.calendar': 'Calendar',
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
  'home.dailyStars': '{n} of {total}',
  'home.dailyStarsLabel': '{n} of {total} stars this month',
  'home.league': 'League',
  'home.leagueRank': '{league} · {rank}',
  'home.leagueJoin': 'Win a board to join today',
  'home.event': 'Event',
  'home.eventNote': 'A drawing board',
  'calendar.title': 'Daily challenge',
  'calendar.previous': 'Previous month',
  'calendar.next': 'Next month',
  'calendar.stars': '{n} of {total} stars',
  'calendar.moved': '{month}, {n} of {total} stars',
  'calendar.days': 'Days of {month}',
  'calendar.today': 'today',
  'calendar.done': 'star earned',
  'calendar.locked': 'locked',
  'calendar.trophies': 'Trophies',
  'calendar.noTrophies': 'Win every day of a month to earn its trophy.',
  'calendar.trophy': '{month}: trophy, every day won',
  'calendar.missed': '{n} of {total}',
  'calendar.missedLabel': '{month}: {n} of {total} days won',
  'calendar.play': 'Play today',
  'calendar.board': '{kind} board · {tier} · {width} × {height}',
  'calendar.weekday': 'Weekday',
  'calendar.weekend': 'Weekend',
  'league.title': 'Daily league',
  'league.info': 'How the league works',
  'league.resets': 'Resets in {time}',
  'league.rules.both': 'Top 10 move up to {up}, bottom 10 move down to {down}.',
  'league.rules.bottom': 'Top 10 move up to {up}. Nobody moves down from {league}.',
  'league.rules.top': 'Bottom 10 move down to {down}. {league} is the top league.',
  'league.characters': 'You’re playing against the game’s characters until the league has players.',
  'league.join': 'Win a board today to join the table.',
  'league.table': '{league} table',
  'league.you': 'You',
  'league.character': 'character',
  'league.points.one': '1 point',
  'league.points.other': '{n} points',
  'league.movesUp': 'moves up',
  'league.movesDown': 'moves down',
  'league.aboveUp': 'Above moves up',
  'league.belowDown': 'Below moves down',
  'league.howTitle': 'How the league works',
  'league.howBody':
    'Every board you win today earns points: more for harder and bigger boards, a fast time and no chances lost, and a bonus on event boards. Each board counts once a day. At midnight the top 10 move up a league and the bottom 10 move down; a day without a board won leaves your league as it is. Until the league has players, the other 29 are the game’s characters, simulated on your phone and marked “character”.',
  'league.gotIt': 'Got it',
  'league.summaryTitle': 'While you were away',
  'league.summary.promoted':
    'You finished {rank} in {league} on {day}, with {points}, and moved up to {next}.',
  'league.summary.stayed':
    'You finished {rank} in {league} on {day}, with {points}, and stay in {league}.',
  'league.summary.relegated':
    'You finished {rank} in {league} on {day}, with {points}, and moved down to {next}.',
  'league.continue': 'Continue',
  'league.see': 'See the league',
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
  'won.star': 'A star for {day}.',
  'won.trophy': 'Every day of {month} won: a trophy!',
  'won.league': '+{points} in {league} league · now {rank}.',
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

// Day and month names come from tables, not Intl: engines disagree on details
// such as "Sep" or "Sept" and the comma after a weekday, and a second language
// is a second table.
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
/** Sunday first, as `Date.getUTCDay` counts. */
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const short = (name: string): string => name.slice(0, 3);

interface DayParts {
  readonly year: number;
  readonly month: string;
  readonly day: number;
  readonly weekday: string;
}

function dayParts(dateKey: string): DayParts {
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    year: date.getUTCFullYear(),
    month: MONTHS[date.getUTCMonth()]!,
    day: date.getUTCDate(),
    weekday: WEEKDAYS[date.getUTCDay()]!,
  };
}

/** `2026-10-03` as `Sat 3 Oct`, the way the home screen names a day. */
export function formatDayShort(dateKey: string): string {
  const { weekday, day, month } = dayParts(dateKey);
  return `${short(weekday)} ${day} ${short(month)}`;
}

/** `2026-10-03` as `Saturday 3 October`, for screen readers on the calendar. */
export function formatDayLong(dateKey: string): string {
  const { weekday, day, month } = dayParts(dateKey);
  return `${weekday} ${day} ${month}`;
}

/** `2026-10-02` as `Oct 2, 2026`, in a daily board's title. */
export function formatDateKey(dateKey: string): string {
  const { year, day, month } = dayParts(dateKey);
  return `${short(month)} ${day}, ${year}`;
}

/** `2026-10` as `October 2026`. */
export function formatMonth(month: string): string {
  const parts = dayParts(`${month}-01`);
  return `${parts.month} ${parts.year}`;
}

/** `2026-09` as `Sep`, or `Sep 2025` when `currentYear` is another year. */
export function formatMonthShort(month: string, currentYear: number): string {
  const parts = dayParts(`${month}-01`);
  const name = short(parts.month);
  return parts.year === currentYear ? name : `${name} ${parts.year}`;
}

/** The calendar's weekday heads from Monday: narrow (`M`) and long (`Monday`). */
export function weekdayNames(): { narrow: string; long: string }[] {
  return [...WEEKDAYS.slice(1), WEEKDAYS[0]].map((long) => ({ narrow: long.slice(0, 1), long }));
}

/** `1st`, `2nd`, `3rd`, `4th`, `11th`, `21st`: a rank in the league table. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Time left as `7h 48m`, or `12m` within the hour; minutes round up, so never `0m`. */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
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
