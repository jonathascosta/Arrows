import type { LeagueName } from '@arrows/engine';

/**
 * Every player-facing string, by key, in English and in Portuguese (Brazil's):
 * docs/PRODUCT.md, Languages. Placeholders are `{name}`. The English table is
 * the list of keys; the Portuguese one must have every key, and the same
 * placeholders.
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
  'home.menu': 'Settings',
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
  'home.eventBoards': '{n} of {total} boards',
  'home.eventDaysLeft': '{n} days left',
  'home.eventLastDay': 'Last day',
  'home.eventEnded': 'Ended {date}',
  'home.eventBadge': 'Badge earned',
  'event.autumn2026': 'Autumn event',
  'event.autumn2026.short': 'Autumn',
  'event.autumn2026.badge': 'Autumn 2026 badge',
  'event.boardOf': '{event} · {n} of {total}',
  'drawing.heart': 'Heart',
  'drawing.butterfly': 'Butterfly',
  'drawing.maple-leaf': 'Maple leaf',
  'drawing.acorn': 'Acorn',
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
  'league.name.Bronze': 'Bronze',
  'league.name.Silver': 'Silver',
  'league.name.Gold': 'Gold',
  'league.name.Platinum': 'Platinum',
  'league.name.Diamond': 'Diamond',
  'league.name.Master': 'Master',
  'league.name.Legend': 'Legend',
  'league.info': 'How the league works',
  'league.resets': 'Resets in {time}',
  'league.rules.both': 'Top 10 move up to {up}, bottom 10 move down to {down}.',
  'league.rules.bottom': 'Top 10 move up to {up}. Nobody moves down from {league}.',
  'league.rules.top': 'Bottom 10 move down to {down}. {league} is the top league.',
  'league.characters': 'You’re playing against the game’s characters until the league has players.',
  'league.join': 'Win a board today to join the table.',
  'league.table': '{league} table',
  'league.you': 'You',
  'league.notJoined': 'not in today’s table until you win a board',
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
  'tools.hintLoading': 'Loading ad…',
  'tools.ad': 'AD',
  'tools.adNote': '(plays an ad)',
  'board.label.one': 'Board, 1 arrow left. Pinch or scroll to zoom, drag to move.',
  'board.label.other': 'Board, {n} arrows left. Pinch or scroll to zoom, drag to move.',
  'status.blocked.one': 'Blocked. 1 chance left.',
  'status.blocked.other': 'Blocked. {n} chances left.',
  'status.hint': 'Try the highlighted arrow.',
  'status.noHint': 'No free arrow right now.',
  'status.noReward': 'No hint: the ad was closed before the end.',
  'status.noAd': 'No hint: no ad could be shown.',
  'won.title': 'Solved',
  'won.heading': '{title} · {subtitle}',
  'won.time': 'Time',
  'won.chancesLost': 'Chances lost',
  'won.chancesLostOf': '{n} of {total}',
  'won.score': 'Score',
  'won.firstTry': 'First try. Win streak is now {n}.',
  'won.streakOver': 'Not on the first try, so the streak starts again.',
  'won.newBest': 'new best',
  'won.best': 'best {time}',
  'won.star': 'A star for {day}.',
  'won.trophy': 'Every day of {month} won: a trophy!',
  'won.league': '+{points} in {league} league · now {rank}.',
  'won.leagueCounted': 'Already counted in today’s league.',
  'won.next': 'Next level',
  'won.nextBoard': 'Next board',
  'won.eventBoard': 'Board {n} of {total} done.',
  'won.eventComplete': 'Every board won: the {badge} is yours!',
  'won.again': 'Play again',
  'lost.title': 'Out of chances',
  'lost.body': 'Retry plays the same puzzle again, with {total} fresh chances and the timer reset.',
  'lost.retry': 'Retry',
  'ads.test.title': 'Test ad',
  'ads.test.interstitial': 'An interstitial ad would show here, between the board and its score.',
  'ads.test.rewarded': 'A rewarded ad would show here. Watched to the end, it earns the hint.',
  'ads.test.close': 'Close ad',
  'ads.test.finish': 'Watch to the end',
  'ads.test.skip': 'Close without the reward',
  'settings.title': 'Settings',
  'settings.sound': 'Sound',
  'settings.haptics': 'Haptics',
  'settings.picker': 'Puzzle picker',
  'settings.done': 'Done',
} as const;

export type StringKey = keyof typeof en;

/** Every key, in the English table's order. */
export const STRING_KEYS = Object.keys(en) as StringKey[];

/** Brazilian Portuguese. Every English key, with the same placeholders (strings.test.ts). */
const pt: Readonly<Record<StringKey, string>> = {
  'app.name': 'Arrows',
  'title.level': 'Nível {n}',
  'title.daily': 'Diário · {date}',
  'tier.easy': 'Fácil',
  'tier.medium': 'Médio',
  'tier.hard': 'Difícil',
  'tier.superHard': 'Muito difícil',
  'nav.back': 'Voltar ao início',
  'nav.home': 'Início',
  'nav.backCalendar': 'Voltar ao calendário',
  'nav.calendar': 'Calendário',
  'home.levels': 'Níveis',
  'home.play': 'Jogar',
  'home.streak': 'Sequência {n}',
  'home.streakLabel': 'Sequência de vitórias: {n}',
  'home.menu': 'Ajustes',
  'home.path': 'Caminho dos níveis',
  'home.done': 'Nível {n}, concluído',
  'home.current': 'Nível {n}, o próximo a jogar',
  'home.ahead': 'Nível {n}, mais adiante',
  'home.daily': 'Diário',
  'home.dailyStars': '{n} de {total}',
  'home.dailyStarsLabel': '{n} de {total} estrelas neste mês',
  'home.league': 'Liga',
  'home.leagueRank': '{league} · {rank}',
  'home.leagueJoin': 'Vença um tabuleiro para entrar hoje',
  'home.eventBoards': '{n} de {total} tabuleiros',
  'home.eventDaysLeft': 'faltam {n} dias',
  'home.eventLastDay': 'Último dia',
  'home.eventEnded': 'Terminou {date}',
  'home.eventBadge': 'Medalha conquistada',
  'event.autumn2026': 'Evento de outono',
  'event.autumn2026.short': 'Outono',
  'event.autumn2026.badge': 'medalha de outono 2026',
  'event.boardOf': '{event} · {n} de {total}',
  'drawing.heart': 'Coração',
  'drawing.butterfly': 'Borboleta',
  'drawing.maple-leaf': 'Folha de bordo',
  'drawing.acorn': 'Bolota',
  'calendar.title': 'Desafio diário',
  'calendar.previous': 'Mês anterior',
  'calendar.next': 'Próximo mês',
  'calendar.stars': '{n} de {total} estrelas',
  'calendar.moved': '{month}, {n} de {total} estrelas',
  'calendar.days': 'Dias de {month}',
  'calendar.today': 'hoje',
  'calendar.done': 'estrela conquistada',
  'calendar.locked': 'bloqueado',
  'calendar.trophies': 'Troféus',
  'calendar.noTrophies': 'Vença todos os dias de um mês para ganhar o troféu dele.',
  'calendar.trophy': '{month}: troféu, todos os dias vencidos',
  'calendar.missed': '{n} de {total}',
  'calendar.missedLabel': '{month}: {n} de {total} dias vencidos',
  'calendar.play': 'Jogar o de hoje',
  'calendar.board': 'Tabuleiro {kind} · {tier} · {width} × {height}',
  'calendar.weekday': 'de dia útil',
  'calendar.weekend': 'de fim de semana',
  'league.title': 'Liga diária',
  'league.name.Bronze': 'Bronze',
  'league.name.Silver': 'Prata',
  'league.name.Gold': 'Ouro',
  'league.name.Platinum': 'Platina',
  'league.name.Diamond': 'Diamante',
  'league.name.Master': 'Mestre',
  'league.name.Legend': 'Lenda',
  'league.info': 'Como a liga funciona',
  'league.resets': 'Recomeça em {time}',
  'league.rules.both': 'Os 10 primeiros sobem para {up}, os 10 últimos descem para {down}.',
  'league.rules.bottom': 'Os 10 primeiros sobem para {up}. Ninguém desce de {league}.',
  'league.rules.top': 'Os 10 últimos descem para {down}. {league} é a liga mais alta.',
  'league.characters': 'Você joga contra os personagens do jogo até a liga ter jogadores.',
  'league.join': 'Vença um tabuleiro hoje para entrar na tabela.',
  'league.table': 'Tabela da liga {league}',
  'league.you': 'Você',
  'league.notJoined': 'fora da tabela de hoje até vencer um tabuleiro',
  'league.character': 'personagem',
  'league.points.one': '1 ponto',
  'league.points.other': '{n} pontos',
  'league.movesUp': 'sobe',
  'league.movesDown': 'desce',
  'league.aboveUp': 'Daqui para cima sobe',
  'league.belowDown': 'Daqui para baixo desce',
  'league.howTitle': 'Como a liga funciona',
  'league.howBody':
    'Cada tabuleiro que você vence hoje dá pontos: mais para tabuleiros mais difíceis e maiores, para um tempo rápido e nenhuma chance perdida, e um bônus nos tabuleiros de evento. Cada tabuleiro conta uma vez por dia. À meia-noite os 10 primeiros sobem de liga e os 10 últimos descem; um dia sem vitória deixa você na mesma liga. Até a liga ter jogadores, os outros 29 são personagens do jogo, simulados no seu telefone e marcados como “personagem”.',
  'league.gotIt': 'Entendi',
  'league.summaryTitle': 'Enquanto você esteve fora',
  'league.summary.promoted':
    'Você terminou em {rank} na liga {league} em {day}, com {points}, e subiu para {next}.',
  'league.summary.stayed':
    'Você terminou em {rank} na liga {league} em {day}, com {points}, e continua na liga {league}.',
  'league.summary.relegated':
    'Você terminou em {rank} na liga {league} em {day}, com {points}, e desceu para {next}.',
  'league.continue': 'Continuar',
  'league.see': 'Ver a liga',
  'hud.chances': '{n} de {total} chances restantes',
  'hud.timer': 'Tempo {time}',
  'tools.grid': 'Grade',
  'tools.hint': 'Dica',
  'tools.hintShown': 'Dica à vista',
  'tools.hintLoading': 'Carregando anúncio…',
  'tools.ad': 'AD',
  'tools.adNote': '(mostra um anúncio)',
  'board.label.one':
    'Tabuleiro, 1 flecha restante. Pince ou role para dar zoom, arraste para mover.',
  'board.label.other':
    'Tabuleiro, {n} flechas restantes. Pince ou role para dar zoom, arraste para mover.',
  'status.blocked.one': 'Bloqueada. Resta 1 chance.',
  'status.blocked.other': 'Bloqueada. Restam {n} chances.',
  'status.hint': 'Tente a flecha destacada.',
  'status.noHint': 'Nenhuma flecha livre agora.',
  'status.noReward': 'Sem dica: o anúncio foi fechado antes do fim.',
  'status.noAd': 'Sem dica: nenhum anúncio pôde ser exibido.',
  'won.title': 'Resolvido',
  'won.heading': '{title} · {subtitle}',
  'won.time': 'Tempo',
  'won.chancesLost': 'Chances perdidas',
  'won.chancesLostOf': '{n} de {total}',
  'won.score': 'Pontuação',
  'won.firstTry': 'De primeira. Sequência de vitórias: {n}.',
  'won.streakOver': 'Não foi de primeira, então a sequência recomeça.',
  'won.newBest': 'novo recorde',
  'won.best': 'recorde {time}',
  'won.star': 'Uma estrela para {day}.',
  'won.trophy': 'Todos os dias de {month} vencidos: um troféu!',
  'won.league': '+{points} na liga {league} · agora em {rank}.',
  'won.leagueCounted': 'Já contou na liga de hoje.',
  'won.next': 'Próximo nível',
  'won.nextBoard': 'Próximo tabuleiro',
  'won.eventBoard': 'Tabuleiro {n} de {total} concluído.',
  'won.eventComplete': 'Todos os tabuleiros vencidos: a {badge} é sua!',
  'won.again': 'Jogar de novo',
  'lost.title': 'Sem chances',
  'lost.body':
    'Tentar de novo recomeça o mesmo quebra-cabeça, com {total} chances novas e o tempo zerado.',
  'lost.retry': 'Tentar de novo',
  'ads.test.title': 'Anúncio de teste',
  'ads.test.interstitial':
    'Um anúncio intersticial apareceria aqui, entre o tabuleiro e a pontuação.',
  'ads.test.rewarded': 'Um anúncio premiado apareceria aqui. Assistido até o fim, ele dá a dica.',
  'ads.test.close': 'Fechar anúncio',
  'ads.test.finish': 'Assistir até o fim',
  'ads.test.skip': 'Fechar sem a recompensa',
  'settings.title': 'Ajustes',
  'settings.sound': 'Som',
  'settings.haptics': 'Vibração',
  'settings.picker': 'Escolher quebra-cabeça',
  'settings.done': 'Pronto',
};

/** The languages the game speaks (docs/PRODUCT.md, Languages). */
export type Locale = 'en' | 'pt';

const TABLES: Readonly<Record<Locale, Readonly<Record<StringKey, string>>>> = { en, pt };

/** Each locale as a BCP 47 tag: the page's `lang`. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = { en: 'en', pt: 'pt-BR' };

let current: Locale = 'en';

/** The language the strings below speak from now on. */
export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** The first of the device's languages that the game speaks, English when none is. */
export function localeFor(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'pt' || base === 'en') return base;
  }
  return 'en';
}

/** Whether a key exists, for keys built from data (a drawing's id). */
export function hasString(key: string): key is StringKey {
  return key in en;
}

export function t(key: StringKey, params: Readonly<Record<string, string | number>> = {}): string {
  return TABLES[current][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * A string that depends on a count: `{n}` is the count. One takes the `.one`
 * form, any other count `.other`, as both languages do for whole numbers.
 */
export function tn(
  key: PluralKey,
  n: number,
  params: Readonly<Record<string, string | number>> = {},
): string {
  return t(`${key}.${Math.abs(n) === 1 ? 'one' : 'other'}`, { ...params, n });
}

/** Keys that come in `.one` and `.other` forms, chosen by count. */
type PluralBase<K> = K extends `${infer Base}.other` ? Base : never;
export type PluralKey = PluralBase<StringKey>;

/** A league's name in the player's language. */
export function leagueLabel(name: LeagueName): string {
  return t(`league.name.${name}`);
}

/** A drawing's title: translated when the strings know it, the art's own name otherwise. */
export function drawingTitle(id: string, name: string): string {
  const key = `drawing.${id}`;
  return hasString(key) ? t(key) : name;
}

/** The first letter in capitals, for a date that starts a line ("Sáb 3 out"). */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(LOCALE_TAGS[current]) + text.slice(1);
}

/**
 * Small counts in words, as running text prefers ("three fresh chances"),
 * digits from 11. The Portuguese words are feminine: they count chances.
 */
const SMALL_NUMBERS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  pt: ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
};

export function spellOut(n: number): string {
  return SMALL_NUMBERS[current][n] ?? String(n);
}

// Day and month names come from tables, not Intl: engines disagree on details
// such as "Sep" or "Sept" and the comma after a weekday.
interface Names {
  readonly months: readonly string[];
  /** Sunday first, as `Date.getUTCDay` counts. */
  readonly weekdays: readonly string[];
  readonly shortMonths: readonly string[];
  readonly shortWeekdays: readonly string[];
}

const NAMES: Readonly<Record<Locale, Names>> = {
  en: {
    months: [
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
    ],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    shortMonths: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    shortWeekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  pt: {
    months: [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ],
    weekdays: [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ],
    shortMonths: [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ],
    shortWeekdays: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  },
};

interface DayParts {
  readonly year: number;
  /** 0 for January. */
  readonly month: number;
  readonly day: number;
  /** 0 for Sunday. */
  readonly weekday: number;
}

function dayParts(dateKey: string): DayParts {
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

/** `2026-10-03` as `Sat 3 Oct` or `sáb 3 out`: a day in running text, and on the home card. */
export function formatDayShort(dateKey: string): string {
  const { weekday, day, month } = dayParts(dateKey);
  const names = NAMES[current];
  return `${names.shortWeekdays[weekday]!} ${day} ${names.shortMonths[month]!}`;
}

/** `2026-10-03` as `Saturday 3 October` or `sábado, 3 de outubro`, for screen readers. */
export function formatDayLong(dateKey: string): string {
  const { weekday, day, month } = dayParts(dateKey);
  const names = NAMES[current];
  return current === 'pt'
    ? `${names.weekdays[weekday]!}, ${day} de ${names.months[month]!}`
    : `${names.weekdays[weekday]!} ${day} ${names.months[month]!}`;
}

/** `2026-10-02` as `Oct 2, 2026` or `2 out 2026`, in a daily board's title. */
export function formatDateKey(dateKey: string): string {
  const { year, day, month } = dayParts(dateKey);
  const name = NAMES[current].shortMonths[month]!;
  return current === 'pt' ? `${day} ${name} ${year}` : `${name} ${day}, ${year}`;
}

/** `2026-10` as `October 2026` or `outubro de 2026`, in running text. */
export function formatMonth(month: string): string {
  const parts = dayParts(`${month}-01`);
  const name = NAMES[current].months[parts.month]!;
  return current === 'pt' ? `${name} de ${parts.year}` : `${name} ${parts.year}`;
}

/** A month heading a screen or a line: `October 2026`, `Outubro de 2026`. */
export function formatMonthTitle(month: string): string {
  return capitalize(formatMonth(month));
}

/** `2026-09` as `Sep` (`set`), or `Sep 2025` when `currentYear` is another year. */
export function formatMonthShort(month: string, currentYear: number): string {
  const parts = dayParts(`${month}-01`);
  const name = NAMES[current].shortMonths[parts.month]!;
  return parts.year === currentYear ? name : `${name} ${parts.year}`;
}

/** The calendar's weekday heads from Monday: narrow (`M`, `S`) and long (`Monday`, `segunda-feira`). */
export function weekdayNames(): { narrow: string; long: string }[] {
  const { weekdays } = NAMES[current];
  return [...weekdays.slice(1), weekdays[0]!].map((long) => ({
    narrow: long.slice(0, 1).toLocaleUpperCase(LOCALE_TAGS[current]),
    long,
  }));
}

/** A rank in the league table: `1st`, `2nd`, `11th`, `21st`; `1º` in Portuguese. */
export function ordinal(n: number): string {
  if (current === 'pt') return `${n}º`;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Time left as `7h 48m` (one unbreakable piece), or `12m` within the hour; minutes round up, so never `0m`. */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  // A no-break space: the time never splits across lines.
  return hours > 0 ? `${hours}h\u00a0${minutes % 60}m` : `${minutes}m`;
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
