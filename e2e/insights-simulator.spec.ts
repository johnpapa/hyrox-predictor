import { expect, test } from './fixtures';

test.describe('insights panel', () => {
  test('shows limiters, time savings and pacing that react to inputs', async ({ page }) => {
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.bar-row')).toHaveCount(9);
    await expect(panel.locator('.hint')).toBeVisible(); // nothing entered yet
    await page.getByLabel('Current 5K best').fill('22:30');
    await page.getByLabel('Max unbroken wall balls').fill('12');
    await expect(panel.locator('.headline')).toContainText('Wall Balls');
    await expect(panel.locator('.hint')).toBeHidden();
    await expect(panel.locator('.whatifs li').first()).toBeVisible();
    await expect(panel.locator('.whatifs')).toContainText('+15 unbroken wall balls');
    await expect(panel.locator('.pacing')).toContainText('Run 1');
  });

  test('team divisions: switch whose insights are shown', async ({ app, page }) => {
    await app.division('Mixed Doubles').click();
    const panel = page.locator('app-insights-panel');
    await panel.getByRole('button', { name: 'Athlete 2' }).click();
    await expect(panel.getByRole('button', { name: 'Athlete 2' })).toHaveAttribute('aria-pressed', 'true');
    await expect(app.tab(1)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('race simulator page', () => {
  test('opens from the header, starts at the prediction, and sliders change the total', async ({ app, page }) => {
    await page.getByLabel('Current 5K best').fill('23:00');
    const predicted = await app.total();
    await page.getByRole('link', { name: 'Simulator' }).click();
    await expect(page).toHaveURL(/#simulator$/);
    const clock = page.locator('app-simulator-page .clock');
    await expect(clock).toHaveText(new RegExp(new Date(predicted * 1000).toISOString().slice(11, 19)));
    await expect(page.locator('app-simulator-page .row')).toHaveCount(17);

    await page.getByLabel('Wall Balls slider').fill('240');
    await expect(page.locator('app-simulator-page .delta')).toContainText('−');
    await expect(page.locator('app-simulator-page .delta')).toHaveClass(/faster/);
    const row = page.locator('app-simulator-page .row').filter({ hasText: 'Wall Balls' });
    await expect(row.getByRole('textbox')).toHaveValue('04:00');
    await row.getByRole('button', { name: /Reset/ }).click();
    await expect(page.locator('app-simulator-page .delta')).toContainText('±0:00');
  });

  test('type a split, scale all runs, and hit a target time', async ({ page }) => {
    await page.goto('./#simulator');
    const sim = page.locator('app-simulator-page');
    const run1 = sim.locator('.row').filter({ hasText: 'Running 1' });
    await run1.getByRole('textbox').fill('4:30');
    await run1.getByRole('textbox').press('Enter');
    await expect(run1.getByRole('textbox')).toHaveValue('04:30');
    await sim.getByLabel('Scale all runs, percent').fill('10');
    await expect(sim.locator('.controls')).toContainText('+10%');
    await sim.getByLabel('Target finish time').fill('1:20:00');
    await sim.getByRole('button', { name: 'Hit target' }).click();
    await expect(sim.locator('.clock')).toHaveText('01:20:00');
    await sim.getByRole('button', { name: 'Reset to prediction' }).click();
    await expect(sim.locator('.delta')).toContainText('±0:00');
  });

  test('works for team divisions and returns to the predictor', async ({ app, page }) => {
    await app.division("Men's Relay").click();
    await page.getByRole('link', { name: 'Simulator' }).click();
    await expect(page.locator('app-simulator-page')).toContainText("Men's Relay");
    await expect(page.locator('app-simulator-page .band')).toHaveCount(0); // bands are singles-only
    await page.getByRole('link', { name: 'Predictor' }).click();
    await expect(page.locator('app-results-board')).toBeVisible();
  });
});
