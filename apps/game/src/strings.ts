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
  'nav.back': 'Back to puzzles',
  'hud.drops': '{n} of {total} drops left',
  'hud.timer': 'Time {time}',
  'hud.hint': 'Hint',
  'hud.gridShow': 'Show grid',
  'hud.gridHide': 'Hide grid',
  'board.label': 'Board, {n} arrows left. Pinch or scroll to zoom, drag to move.',
  'status.blocked': 'Blocked. {n} drops left.',
  'status.hint': 'Try the highlighted arrow.',
  'status.noHint': 'No free arrow right now.',
  'won.title': 'Board cleared!',
  'won.summary': '{time} · {drops} of {total} drops left',
  'won.next': 'Next level',
  'won.again': 'Play again',
  'lost.title': 'Out of drops',
  'lost.body': 'Same board, fresh drops. Look before you tap.',
  'lost.retry': 'Retry',
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey, params: Readonly<Record<string, string | number>> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
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
