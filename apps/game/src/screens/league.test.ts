import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinishedBoard } from '../league/provider.ts';
import { SimulatedLeagueProvider } from '../league/simulated.ts';
import { LeagueStore } from '../persistence/league.ts';
import { MemoryStore } from '../persistence/store.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import { avatarColour, initials, LEAGUE_TICK_MS, LeagueScreen } from './league.ts';

const big: FinishedBoard = {
  key: 'level:900',
  tier: 'superHard',
  cellCount: 2000,
  timeSeconds: 1,
  chancesLost: 0,
  event: false,
};

interface Harness {
  root: HTMLElement;
  screen: LeagueScreen;
  clock: { now: Date };
  provider: SimulatedLeagueProvider;
}

function mount(store = new MemoryStore(), now = new Date(2026, 9, 14, 16, 12)): Harness {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const clock = { now };
  const provider = new SimulatedLeagueProvider(store, 'You');
  const screen = new LeagueScreen(root, {
    theme: DEFAULT_THEME,
    league: provider,
    clock: () => clock.now,
    homeHref: './',
  });
  return { root, screen, clock, provider };
}

function seed(store: MemoryStore, league: number): void {
  new LeagueStore(store).save({
    version: 1,
    league,
    day: '2026-10-14',
    points: 0,
    boards: [],
    summary: null,
  });
}

describe('LeagueScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('heads the table with the league, the countdown and the rules', () => {
    const { root } = mount();
    expect(root.querySelector('h1')?.textContent).toBe('Daily league');
    expect(document.title).toBe('Daily league · Arrows');
    expect(root.querySelector('.league-name')?.textContent).toBe('Bronze');
    expect(root.querySelector('.league-reset')?.textContent).toBe('Resets in 7h\u00a048m');
    expect(root.querySelector('.league-rules')?.textContent).toBe(
      'Top 10 move up to Silver. Nobody moves down from Bronze. You’re playing against the game’s characters until the league has players.',
    );
    expect(root.querySelector<HTMLElement>('.league-join')?.hidden).toBe(false);
    expect(root.querySelector('.back')?.getAttribute('href')).toBe('./');
  });

  it('says where the top and the bottom move in every league', () => {
    const store = new MemoryStore();
    seed(store, 3);
    expect(mount(store).root.querySelector('.league-rules')?.textContent).toContain(
      'Top 10 move up to Diamond, bottom 10 move down to Gold.',
    );
    seed(store, 6);
    expect(mount(store).root.querySelector('.league-rules')?.textContent).toContain(
      'Bottom 10 move down to Master. Legend is the top league.',
    );
  });

  it('lists 30 with the player, avatars, tags and the dividers where moves happen', () => {
    const store = new MemoryStore();
    seed(store, 2);
    const { root } = mount(store);
    const rows = [...root.querySelectorAll<HTMLElement>('.league-row')];
    expect(rows).toHaveLength(30);
    expect(rows.map((row) => Number(row.dataset.rank))).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    // Dividers after the 10th and before the 21st, hidden from screen readers.
    const items = [...root.querySelectorAll('.league-table > li')];
    const dividers = items.flatMap((item, i) =>
      item.classList.contains('league-divider') ? [i] : [],
    );
    expect(dividers).toEqual([10, 21]);
    expect(items[10]?.textContent).toBe('Above moves up');
    expect(items[21]?.textContent).toBe('Below moves down');
    expect(items[10]?.getAttribute('aria-hidden')).toBe('true');

    const character = rows.find((row) => row.dataset.kind === 'character')!;
    const name = character.querySelector('.row-name')!.textContent;
    expect(character.querySelector('.avatar')?.textContent).toBe(initials(name));
    expect(
      character.querySelector<HTMLElement>('.avatar')!.style.getPropertyValue('--avatar'),
    ).toMatch(/^var\(--avatar-\d\)$/);
    expect(character.querySelector('.tag')?.textContent).toBe('character');
    // The names are English in either language.
    expect(character.querySelector('.row-name')?.getAttribute('lang')).toBe('en');

    // Before a board is won today the player has no place: last, no rank, no move.
    const player = root.querySelector<HTMLElement>('.league-row[data-kind="player"]')!;
    expect(player.dataset.rank).toBe('30');
    expect(player.dataset.zone).toBe('stay');
    expect(player.querySelector('.rank')?.textContent).toBe('–');
    expect(player.getAttribute('aria-current')).toBe('true');
    expect(player.querySelector('.row-name')?.textContent).toBe('You');
    expect(player.querySelector('.row-name')?.hasAttribute('lang')).toBe(false);
    expect(player.querySelector('.tag')).toBeNull();
    expect(player.querySelector('.sr-only')?.textContent).toBe(
      'You, not in today’s table until you win a board',
    );
    // The characters take ranks 1 to 29, the last nine of them in the zone that moves down.
    expect(rows.filter((row) => row.dataset.zone === 'down')).toHaveLength(9);
  });

  it('reads each row as one sentence', () => {
    const { root } = mount();
    const first = root.querySelector('.league-row[data-rank="1"]')!;
    const name = first.querySelector('.row-name')!.textContent;
    const score = first.querySelector('.score')!.textContent;
    expect(first.querySelector('.sr-only')?.textContent).toBe(
      `1st, ${name}, character, ${score} points, moves up`,
    );
  });

  it('shows the player’s points and rank once a board is won', () => {
    const store = new MemoryStore();
    const now = new Date(2026, 9, 14, 16, 12);
    new SimulatedLeagueProvider(store, 'You').record(big, now);
    const { root } = mount(store, now);
    expect(root.querySelector<HTMLElement>('.league-join')?.hidden).toBe(true);
    const player = root.querySelector('.league-row[data-kind="player"]')!;
    expect(player.getAttribute('data-rank')).toBe('1');
    expect(player.querySelector('.rank')?.textContent).toBe('1');
    expect(player.querySelector('.sr-only')?.textContent).toMatch(
      /^1st, You, [\d,]+ points, moves up$/,
    );
  });

  it('opens the rules on the info button and gives the page back after', () => {
    const { root } = mount();
    const info = root.querySelector<HTMLButtonElement>('.info')!;
    expect(info.getAttribute('aria-label')).toBe('How the league works');
    info.click();
    const sheet = root.querySelector<HTMLElement>('.overlay')!;
    expect(sheet.hidden).toBe(false);
    expect(sheet.dataset.overlay).toBe('rules');
    expect(sheet.querySelector('p')?.textContent).toContain('simulated on your phone');
    expect(root.querySelector('.league-table')?.hasAttribute('inert')).toBe(true);
    sheet.querySelector('button')!.click();
    expect(sheet.hidden).toBe(true);
    expect(root.querySelector('.league-table')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(info);
  });

  it('moves the table on its own, and settles the day at midnight with a summary', () => {
    const store = new MemoryStore();
    const provider = new SimulatedLeagueProvider(store, 'You');
    provider.record(big, new Date(2026, 9, 14, 23, 50));
    const { root, clock } = mount(store, new Date(2026, 9, 14, 23, 50));
    expect(root.querySelector('.league-reset')?.textContent).toBe('Resets in 10m');
    clock.now = new Date(2026, 9, 15, 0, 1);
    vi.advanceTimersByTime(LEAGUE_TICK_MS);
    expect(root.querySelector('.league-name')?.textContent).toBe('Silver');
    const sheet = root.querySelector<HTMLElement>('.overlay')!;
    expect(sheet.dataset.overlay).toBe('summary');
    expect(sheet.querySelector('h2')?.textContent).toBe('While you were away');
    expect(sheet.querySelector('p')?.textContent).toMatch(
      /^You finished 1st in Bronze on Wed 14 Oct, with [\d,]+ points, and moved up to Silver\.$/,
    );
    // Shown is seen, before Continue.
    expect(provider.summary(clock.now)).toBeNull();
    sheet.querySelector('button')!.click();
    expect(sheet.hidden).toBe(true);
    // Seen: the next tick does not bring it back.
    vi.advanceTimersByTime(LEAGUE_TICK_MS);
    expect(sheet.hidden).toBe(true);
  });

  it('stops its clock on destroy', () => {
    const { root, screen } = mount();
    expect(vi.getTimerCount()).toBe(1);
    screen.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(root.childElementCount).toBe(0);
  });
});

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Wonderful Butterfly')).toBe('WB');
    expect(initials('smart dog')).toBe('SD');
    expect(initials('You')).toBe('Y');
    expect(initials('  Very  Quiet  Owl ')).toBe('VQ');
  });
});

describe('avatarColour', () => {
  it('keeps a character’s colour and spreads a day’s characters over the palette', async () => {
    const { generateSeason } = await import('@arrows/engine');
    expect(avatarColour('Quick Comet', 7)).toBe(avatarColour('Quick Comet', 7));
    const counts = new Array<number>(7).fill(0);
    for (const character of generateSeason(2, '2026-10-14').characters) {
      counts[avatarColour(character.name, 7)]!++;
    }
    // 29 characters over 7 colours: every colour used, none on more than a third.
    expect(counts.every((n) => n > 0)).toBe(true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(9);
  });
});
