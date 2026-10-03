import { createGame, freeArrows, generateLevel, tap } from '@arrows/engine';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer-core';
import { DEBUG_PORT } from '../playwright.a11y.config.ts';

/** Lighthouse's accessibility score each screen must be above (docs/PRODUCT.md, Accessibility). */
const MINIMUM = 0.9;

const LEAGUE_KEY = 'arrows.league';

/** Taps the arrowhead of an arrow, as a finger would. */
async function tapArrow(page: Page, id: number): Promise<void> {
  const box = await page.locator(`[data-arrow="${id}"] .head`).boundingBox();
  if (box === null) throw new Error(`Arrow ${id} is not on screen`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function winLevel(page: Page, level: number): Promise<void> {
  const { puzzle } = generateLevel(level);
  let game = createGame(puzzle);
  while (game.status === 'playing') {
    const id = freeArrows(game)[0]!;
    await tapArrow(page, id);
    game = tap(game, id).state;
    await expect(page.locator('.play')).toHaveAttribute(
      'data-arrows-left',
      String(game.remaining.size),
    );
  }
}

async function loseLevel(page: Page, level: number): Promise<void> {
  const { puzzle } = generateLevel(level);
  const game = createGame(puzzle);
  const free = new Set(freeArrows(game));
  const id = puzzle.arrows.find((arrow) => !free.has(arrow.id))!.id;
  for (let i = 0; i < game.livesAtStart; i++) await tapArrow(page, id);
}

/** Yesterday's league day, won, so today opens with its summary. */
async function storeYesterday(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const day = new Date(Date.now() - 86_400_000);
    const pad = (n: number): string => String(n).padStart(2, '0');
    const dateKey = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        league: 0,
        day: dateKey,
        points: 50_000,
        boards: ['level:900'],
        summary: null,
      }),
    );
  }, LEAGUE_KEY);
}

/** Runs Lighthouse's accessibility audit on the page as it is, and returns its score. */
async function audit(page: Page, name: string): Promise<number> {
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
    defaultViewport: null,
  });
  try {
    const pages = await browser.pages();
    const target = pages.find((candidate) => candidate.url() === page.url());
    if (target === undefined) throw new Error(`No page at ${page.url()}`);
    const flow = await startFlow(target, {
      name,
      config: {
        extends: 'lighthouse:default',
        settings: {
          onlyCategories: ['accessibility'],
          formFactor: 'mobile',
          screenEmulation: { disabled: true },
        },
      },
    });
    await flow.snapshot({ name });
    const { steps } = await flow.createFlowResult();
    const lhr = steps[0]!.lhr;
    const category = lhr.categories.accessibility!;
    // What fell short, for the report.
    const failing = category.auditRefs
      .filter((ref) => ref.weight > 0 && lhr.audits[ref.id]?.score !== 1)
      .map((ref) => `${ref.id}: ${lhr.audits[ref.id]?.title ?? ''}`);
    // In the test's output, which CI's list reporter prints, and in the HTML report.
    const line = `${name}: ${Math.round((category.score ?? 0) * 100)}${failing.length > 0 ? ` (${failing.join('; ')})` : ''}`;
    process.stdout.write(`Lighthouse accessibility, ${line}\n`);
    test.info().annotations.push({ type: 'lighthouse', description: line });
    return category.score ?? 0;
  } finally {
    await browser.disconnect();
  }
}

/** The names a test looks controls up by, in the page's language. */
interface Words {
  readonly settings: string;
  readonly leagueInfo: string;
  readonly hint: string;
}

interface Screen {
  readonly name: string;
  readonly open: (page: Page, words: Words) => Promise<void>;
  /** Only in English: the puzzle picker is a testing tool, not translated. */
  readonly englishOnly?: boolean;
}

const SCREENS: readonly Screen[] = [
  { name: 'home', open: (page) => page.goto('./').then(() => undefined) },
  {
    name: 'home, settings',
    open: async (page, words) => {
      await page.goto('./');
      await page.getByRole('button', { name: words.settings }).tap();
      await expect(page.getByRole('dialog', { name: words.settings })).toBeVisible();
    },
  },
  {
    name: 'home, the day’s summary',
    open: async (page) => {
      await page.goto('./');
      await storeYesterday(page);
      await page.reload();
      await expect(page.locator('.overlay[data-overlay="summary"]')).toBeVisible();
    },
  },
  {
    name: 'calendar',
    open: async (page) => {
      await page.goto('./?calendar');
      await expect(page.locator('.day').first()).toBeVisible();
    },
  },
  {
    name: 'league',
    open: async (page) => {
      await page.goto('./?league');
      await expect(page.locator('.league-row')).toHaveCount(30);
    },
  },
  {
    name: 'league, the rules',
    open: async (page, words) => {
      await page.goto('./?league');
      await page.getByRole('button', { name: words.leagueInfo }).tap();
      await expect(page.locator('.overlay[data-overlay="rules"]')).toBeVisible();
    },
  },
  {
    name: 'board',
    open: async (page) => {
      await page.goto('./?level=1');
      await expect(page.locator('[data-arrow]').first()).toBeVisible();
    },
  },
  {
    name: 'board, the test ad',
    open: async (page, words) => {
      await page.goto('./');
      await page.evaluate(() => localStorage.setItem('arrows.ads', 'test'));
      await page.goto('./?level=1');
      await page.getByRole('button', { name: new RegExp(`^${words.hint}`) }).tap();
      await expect(page.locator('.test-ad')).toBeVisible();
    },
  },
  {
    name: 'board, lost',
    open: async (page) => {
      await page.goto('./?level=1');
      await loseLevel(page, 1);
      await expect(page.locator('.overlay[data-overlay="lost"]')).toBeVisible();
    },
  },
  {
    name: 'score',
    open: async (page) => {
      await page.goto('./?level=1');
      await winLevel(page, 1);
      await expect(page.locator('.score-screen')).toBeVisible();
    },
  },
  {
    name: 'puzzle picker',
    englishOnly: true,
    open: async (page) => {
      await page.goto('./dev.html');
      await expect(page.locator('h1')).toBeVisible();
    },
  },
];

const LANGUAGES: readonly { locale: string; words: Words }[] = [
  {
    locale: 'en-US',
    words: { settings: 'Settings', leagueInfo: 'How the league works', hint: 'Hint' },
  },
  {
    locale: 'pt-BR',
    words: { settings: 'Ajustes', leagueInfo: 'Como a liga funciona', hint: 'Dica' },
  },
];

for (const { locale, words } of LANGUAGES) {
  test.describe(`in ${locale}`, () => {
    test.use({ locale });

    for (const screen of SCREENS) {
      if (screen.englishOnly === true && locale !== 'en-US') continue;
      test(`${screen.name} is above ${MINIMUM * 100} in Lighthouse accessibility`, async ({
        page,
      }) => {
        await screen.open(page, words);
        expect(await audit(page, `${screen.name} (${locale})`)).toBeGreaterThan(MINIMUM);
      });
    }
  });
}
