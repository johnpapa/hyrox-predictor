/**
 * Generates the screenshots used in docs/TUTORIAL.md.
 * Run with: npm run docs:screenshots
 */
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const out = (name: string) => `docs/tutorial/${name}.png`;

test.describe.configure({ mode: 'serial' });

test('desktop walkthrough', async ({ app, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: out('01-overview') });
  // For element captures only: stop the sticky header overlapping, and show the whole board.
  await page.addStyleTag({
    content: '.topbar{position:relative!important} .results{position:static!important;max-height:none!important;overflow:visible!important}',
  });
  await page.getByLabel('Name').fill('Alex');

  // 1. Division
  await page.locator('app-division-picker').screenshot({ path: out('02-division') });

  // 2. Profile & physiology
  await page.getByLabel('Bodyweight (kg)').fill('78');
  await page.getByLabel('Age', { exact: true }).fill('38');
  await page.locator('#athlete-panel fieldset').nth(0).screenshot({ path: out('03-profile') });

  // 3. Running
  await page.getByLabel('5K', { exact: true }).fill('22:40');
  await app.card('Running').getByLabel('Half marathon').fill('1:44:30');
  await app.card('Running').screenshot({ path: out('04-running') });

  // 4. Strength: a rep set plus a self-rating fallback on another ability
  const legs = app.card('Leg strength');
  await legs.getByLabel('Back squat (kg)').fill('100');
  await legs.getByLabel('Back squat reps').fill('5');
  await legs.screenshot({ path: out('05-lift-reps') });
  const sleds = app.card('Sleds');
  await sleds.getByRole('button', { name: 'Fair', exact: true }).click();
  await sleds.screenshot({ path: out('06-self-rating') });

  // 5. Station inputs
  await page.getByLabel('Max dead hang (sec)').fill('70');
  await page.getByLabel('Max unbroken wall balls').fill('35');
  await app.card('Wall balls').screenshot({ path: out('07-wall-balls') });

  // 6. Confidence
  await page.locator('.confidence').screenshot({ path: out('08-confidence') });

  // 7. Results board
  await page.locator('app-results-board').screenshot({ path: out('09-results') });

  // 7b. Insights
  await page.locator('app-insights-panel').screenshot({ path: out('09b-insights') });

  // 8. Lock a station
  const wb = app.splitRow('Wall Balls');
  await wb.getByRole('button', { name: /Set your own/ }).click();
  await wb.locator('input.edit').fill('6:15');
  await wb.locator('input.edit').press('Enter');
  await page.locator('app-results-board .splits').screenshot({ path: out('10-lock') });
  await wb.getByRole('button', { name: 'Reset to predicted time' }).click();

  // 9. Simulator
  await page.locator('app-results-board').getByRole('button', { name: /Simulate/ }).click();
  await page.waitForTimeout(9000);
  await page.locator('app-results-board .board-head').evaluate((el) => el.scrollIntoView());
  await page.locator('app-results-board .clock-wrap').screenshot({ path: out('11-simulator') });
  await page.locator('app-results-board').getByRole('button', { name: /Stop/ }).click();

  // 10. Doubles
  await app.division('Mixed Doubles').click();
  await page.getByLabel('5K', { exact: true }).fill('22:40');
  await app.tab(1).click();
  await page.getByLabel('Name').fill('Jess');
  await page.getByLabel('5K', { exact: true }).fill('25:30');
  await page.locator('app-team-tactics').screenshot({ path: out('12-doubles') });

  // 11. Relay
  await app.division('Mixed Relay').click();
  await page.locator('app-team-tactics').screenshot({ path: out('13-relay') });

  // 12. Save
  await page.locator('.privacy').screenshot({ path: out('14-save') });
  await expect(page.locator('.privacy')).toContainText('Off by default');

  // 13. Simulator page
  await app.division("Men's Open").click();
  await page.getByRole('link', { name: 'Simulator' }).click();
  await page.getByLabel('Wall Balls slider').fill('300');
  await page.getByLabel('Scale all runs, percent').fill('-5');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out('17-simulator') });
});

test.describe('iPhone', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
  test.use(iphone);

  test('iPhone walkthrough', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('24:10');
    await page.screenshot({ path: out('15-iphone-form') });
    await page.getByRole('button', { name: 'View splits' }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: out('16-iphone-results') });
    await page.getByRole('link', { name: 'Simulator' }).click();
    await page.getByLabel('Sled Push slider').fill('150');
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    await page.screenshot({ path: out('18-iphone-simulator') });
  });
});
