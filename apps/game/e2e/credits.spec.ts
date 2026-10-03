import { expect, press, test } from './fixtures.ts';

test('Settings lead to the credits and the privacy policy, and back', async ({ page, touch }) => {
  await page.goto('./');
  await press(page.getByRole('button', { name: 'Settings' }), touch);
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  // The web runs no ad network: no privacy choices to offer.
  await expect(sheet.getByRole('button', { name: 'Privacy choices' })).toHaveCount(0);

  await press(sheet.getByRole('link', { name: 'Credits' }), touch);
  await expect(page).toHaveURL(/\?credits$/);
  await expect(page.locator('h1')).toHaveText('Credits');
  const font = page.locator('.credit').filter({ hasText: 'Instrument Serif' });
  await press(font.getByText('Licence text'), touch);
  await expect(font.locator('pre')).toContainText('SIL OPEN FONT LICENSE Version 1.1');
  await press(page.getByRole('link', { name: 'Back to home' }), touch);
  await expect(page.locator('.levels-card')).toBeVisible();

  await press(page.getByRole('button', { name: 'Settings' }), touch);
  await press(sheet.getByRole('link', { name: 'Privacy policy' }), touch);
  await expect(page).toHaveURL(/privacy\.html\?from=game$/);
  await expect(page.locator('h1').first()).toHaveText('Arrows privacy policy');
  await press(page.getByRole('link', { name: 'Back to home' }), touch);
  await expect(page.locator('.levels-card')).toBeVisible();
});

test('the privacy policy opened on its own has no way back, only the policy', async ({ page }) => {
  await page.goto('./privacy.html');
  await expect(page.locator('h1').first()).toHaveText('Arrows privacy policy');
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeHidden();
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('the policy and the credits come in Portuguese first', async ({ page }) => {
    await page.goto('./privacy.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('h1').first()).toHaveText('Política de privacidade do Arrows');
    await expect(page.locator('h1').nth(1)).toHaveText('Arrows privacy policy');
    await page.goto('./?credits');
    await expect(page.locator('h1')).toHaveText('Créditos');
  });
});
