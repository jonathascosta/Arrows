import { generateLevel } from '@arrows/engine';
import { expect, press, solveWithHints, test } from './fixtures.ts';

test.describe('on a phone in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('the game speaks Brazilian Portuguese, dates and ranks included', async ({
    page,
    touch,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('.levels-card h2')).toHaveText('Nível 1');
    await expect(page.getByRole('link', { name: 'Jogar', exact: true })).toBeVisible();
    await expect(page.locator('a.daily .card-title')).toHaveText('Qua 14 out');
    await expect(page.locator('a.league .card-title')).toHaveText('Bronze');

    await press(page.getByRole('link', { name: 'Jogar', exact: true }), touch);
    await expect(page.locator('.tier')).toHaveText('Fácil');
    await solveWithHints(page, touch, generateLevel(1).puzzle);
    const score = page.locator('.score-screen');
    await expect(score.locator('h2')).toHaveText('Resolvido');
    await expect(score.locator('.score-lines')).toHaveText(
      'De primeira. Sequência de vitórias: 1.',
    );
    await expect(score.locator('.score-league')).toHaveText(
      /^\+[\d.]+ pontos na liga Bronze · agora em \d+º\.$/,
    );
    await expect(score.getByRole('button', { name: 'Próximo nível' })).toBeVisible();

    await page.goto('./?calendar=2026-10');
    await expect(page.locator('#month-title')).toHaveText('Outubro de 2026');
    await expect(page.locator('.week-heads span')).toHaveText(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
  });
});

test('a phone in another language gets English', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.levels-card h2')).toHaveText('Level 1');
  await context.close();
});
