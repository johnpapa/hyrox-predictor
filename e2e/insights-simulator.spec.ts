import { expect, test } from './fixtures';

test.describe('insights panel', () => {
  test('shows limiters, time savings and pacing that react to inputs', async ({ page }) => {
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.bar-row')).toHaveCount(9);
    await expect(panel.locator('.hint')).toBeVisible(); // nothing entered yet
    await page.getByLabel('5K', { exact: true }).fill('22:30');
    await page.getByLabel('Max unbroken wall balls').fill('12');
    await expect(panel.locator('.headline')).toContainText('Wall Balls');
    await expect(panel.locator('.hint')).toBeHidden();
    await expect(panel.locator('.whatifs li').first()).toBeVisible();
    await expect(panel.locator('.whatifs')).toContainText('12 → 17 unbroken');
    await expect(panel.locator('.tips li').first()).toContainText('Wall balls');
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
    await page.getByLabel('5K', { exact: true }).fill('23:00');
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

test.describe('live total & units', () => {
  test('bodyweight and lifts have an inline kg/lb switch', async ({ app, page }) => {
    const bw = page.locator('app-number-input').filter({ hasText: 'Bodyweight' });
    await bw.getByRole('button', { name: 'Pounds' }).click();
    await page.getByLabel('Bodyweight (lb)').fill('162');
    await bw.getByRole('button', { name: 'Kilograms' }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toHaveValue('73.5');
    await expect(app.card('Leg strength').getByLabel('Back squat (kg)')).toBeVisible();
    await app.card('Leg strength').getByRole('button', { name: 'Pounds' }).click();
    await expect(app.card('Leg strength').getByLabel('Back squat (lb)')).toBeVisible();
  });

  test('every change flashes how much it moved the finish time', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('24:00');
    await page.getByLabel('5K', { exact: true }).fill('22:00');
    await expect(page.locator('app-results-board app-change-chip .chip')).toContainText('faster');
    await page.getByLabel('Max unbroken wall balls').fill('10');
    await expect(page.locator('app-results-board app-change-chip .chip')).toContainText('slower');
  });

  test('the finish time stays visible while editing (dock on phone, floating pill on desktop)', async ({ page, isMobile }) => {
    const dock = page.getByRole('region', { name: 'Predicted finish summary' });
    if (isMobile) {
      await page.getByText('Save my inputs on this device').scrollIntoViewIfNeeded();
      await expect(dock).toBeVisible();
    } else {
      await expect(dock).toBeHidden(); // board clock is on screen
      await page.locator('aside.results').evaluate((el) => el.scrollTo(0, 5000));
      await expect(dock).toBeVisible();
      await page.getByLabel('5K', { exact: true }).fill('21:08');
      await expect(dock.locator('.dock-time')).toHaveText(/\d{2}:\d{2}:\d{2}/);
      await expect(dock.locator('app-change-chip .chip')).toBeVisible();
    }
  });

  test('marathon time is accepted and shapes the running estimate', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await app.card('Running').getByLabel('Marathon', { exact: true }).fill('3:24:00');
    await expect(app.card('Running')).toContainText('Endurance: typical');
    await expect(app.card('Running').locator('.src')).toContainText('5K 21:08 + marathon 3:24:00');
  });
});

test.describe('honest suggestions & height (user feedback)', () => {
  test('REGRESSION: "Not sure" strength shows as worth measuring, never as a made-up kg target', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.unknowns')).toContainText('Test your deadlift');
    await expect(panel.locator('.unknowns')).toContainText('Test your squat');
    await expect(panel.locator('.whatifs')).not.toContainText('kg');
  });

  test('height can be entered in cm or inches', async ({ app, page }) => {
    await page.getByLabel('Height (cm)').fill('170');
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    await expect(page.getByLabel('Height (in)')).toHaveValue('67');
    await expect(page.locator('app-number-input').filter({ hasText: 'Height' })).toContainText('5′7″');
    expect(app).toBeTruthy();
  });

  test('all four race distances can be entered; the mile and Cooper test are gone', async ({ app }) => {
    const card = app.card('Running');
    for (const label of ['5K', '10K', 'Half marathon', 'Marathon']) await expect(card.getByLabel(label, { exact: true })).toBeVisible();
    await expect(card.getByLabel('1 mile')).toHaveCount(0);
    await expect(card.getByText('Cooper')).toHaveCount(0);
  });
});

test.describe('training volume inputs', () => {
  test('weekly running in km or miles, plus other training hours', async ({ page }) => {
    await page.getByLabel('Weekly running (km)').fill('64');
    const field = page.locator('app-number-input').filter({ hasText: 'Weekly running' });
    await field.getByRole('button', { name: 'Miles' }).click();
    await expect(page.getByLabel('Weekly running (mi)')).toHaveValue('40');
    await page.getByLabel('Other training (hrs / week)').pressSequentially('5.5');
    await expect(page.getByLabel('Other training (hrs / week)')).toHaveValue('5.5');
    await expect(page.getByText('Gym, HYROX classes, erg or sled work')).toBeVisible();
  });
});
