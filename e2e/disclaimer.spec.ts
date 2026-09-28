import { expect, test } from './fixtures';

/** The app must make clear it's unofficial, gives no guarantees, and keeps all data on the device. */
test.describe('branding, disclaimer and privacy', () => {
  test('the header shows a plain "HYROX Predictor" title (no logo mark) marked unofficial', async ({ page }) => {
    const brand = page.locator('.brand');
    await expect(brand).toContainText('HYROX');
    await expect(brand).toContainText('Predictor');
    await expect(brand.locator('svg')).toHaveCount(0);
    await expect(page).toHaveTitle('HYROX Predictor (unofficial)');
  });

  test('a notice near the top links to the full disclaimer & privacy section', async ({ page }) => {
    const notice = page.locator('.hero .notice');
    await expect(notice).toContainText('Unofficial fan tool');
    await expect(notice).toContainText('no guarantees');
    await expect(notice).toContainText('Nothing you enter leaves your device');
    await notice.getByRole('button', { name: 'Disclaimer & privacy' }).click();
    const disc = page.locator('#disclaimer');
    await expect(disc).toHaveAttribute('open', '');
    await expect(disc).toBeInViewport();
    for (const phrase of ['not affiliated with, endorsed by', 'not guaranteed to be accurate', 'Not medical or training advice',
      'without warranty of any kind', 'accepts no liability', 'no server', 'no cookies', 'nothing you enter is sent anywhere',
      'local storage']) {
      await expect(disc).toContainText(phrase);
    }
  });

  test('the footer says it on every page, including the Simulator', async ({ page }) => {
    await expect(page.locator('footer.foot')).toContainText('not affiliated with or endorsed by HYROX');
    await page.getByRole('link', { name: 'Simulator' }).click();
    const foot = page.locator('footer.foot');
    await expect(foot).toContainText('no guarantees');
    await expect(foot).toContainText('nothing you enter leaves your device');
    await expect(foot.locator('.app-version')).toHaveText(/^Version \d+\.\d+\.\d+$/);
    await expect(foot.locator('#disclaimer')).toHaveCount(1);
  });
});
