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
    await expect(panel.locator('.unknowns')).toContainText('Enter a deadlift working set');
    await expect(panel.locator('.unknowns')).toContainText('Enter a squat working set');
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

test.describe('insights: why each station differs', () => {
  test('tap a station to see the reasons; overall reasons are summarised', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByLabel('Bodyweight (kg)').fill('73.5');
    await page.getByLabel('Max unbroken wall balls').fill('20');
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.why-all')).toContainText('Wall-ball capacity (20 unbroken');
    const wb = panel.getByRole('button', { name: /Wall Balls .* show why/ });
    await wb.click();
    await expect(wb).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.locator('.bar-item.open .why')).toContainText('20 unbroken');
    await wb.click();
    await expect(panel.locator('.bar-item.open')).toHaveCount(0);
  });

  test('REGRESSION: compares with athletes like you; build and background are shown separately', async ({ app, page }) => {
    // User: "It should be versus athletes like you taking into account my height, my weight,
    // my running times, my age, everything overall."
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByLabel('Bodyweight (kg)').fill('73.5');
    await page.getByLabel('Age', { exact: true }).fill('54');
    const panel = page.locator('app-insights-panel');
    await expect(panel.getByRole('heading', { name: 'Vs. athletes like you' })).toBeVisible();
    await expect(panel).toContainText('share your sex, age, height, weight');
    // Bodyweight no longer makes the sled look slower; it is listed under build instead.
    await expect(panel.getByRole('button', { name: /Sled Push ±0:00/ })).toBeDisabled();
    await expect(panel.locator('.profile')).toContainText('Lighter bodyweight');
    await expect(panel.locator('.profile')).toContainText('Age 54');
    // A deadlift working set shows up with a strength comparison.
    await app.card('Pulling strength').getByLabel('Deadlift (kg)', { exact: true }).fill('60');
    await app.card('Pulling strength').getByLabel('Deadlift reps', { exact: true }).fill('10');
    const pull = panel.getByRole('button', { name: /Sled Pull .* show why/ });
    await pull.click();
    await expect(panel.locator('.bar-item.open .why')).toContainText('for athletes like you');
  });
});

test.describe('age group & body fat', () => {
  test('REGRESSION: shows position within the 5-year age group next to overall', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByLabel('Age', { exact: true }).fill('54');
    await expect(page.locator('app-results-board .field-pos')).toContainText('of Men 50–54');
    await page.getByRole('link', { name: 'Simulator' }).click();
    await expect(page.locator('app-simulator-page .pos')).toContainText('Men 50–54');
  });

  test('body fat is used for estimated strength and explained', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByLabel('Body fat (%)').fill('14');
    await expect(app.card('Leg strength').locator('.src')).toContainText('lean mass at 14% body fat');
    await expect(page.locator('app-insights-panel .profile')).toContainText('Body fat 14%');
  });
});

test.describe('expert review: doubles tips and new inputs', () => {
  test('doubles show how often to switch on each station, with each partner’s share', async ({ app, page }) => {
    await app.division("Men's Doubles").click();
    const panel = page.locator('app-insights-panel');
    const tips = panel.locator('.tips.doubles');
    await expect(panel.getByRole('heading', { name: 'Doubles: how to split each station' })).toBeVisible();
    await expect(tips).toContainText('SkiErg: swap every 100–250 m');
    await expect(tips).toContainText('Row: swap every 250 m');
    await expect(tips).toContainText('Sled push: swap every length');
    await expect(tips).toContainText('Wall balls: swap every 10–15 reps');
    await expect(tips.locator('.plan').first()).toContainText('Athlete 1 ≈');
    await app.division("Men's Open").click();
    await expect(panel.locator('.tips.doubles')).toHaveCount(0);
  });

  test('compromised-running practice changes the prediction; VO₂max says when it is only a cross-check', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    const before = await app.total();
    await page.getByLabel('Runs straight after stations').selectOption({ label: 'Weekly or more' });
    await expect.poll(() => app.total()).toBeLessThan(before);
    await expect(page.locator('app-number-input').filter({ hasText: 'VO₂max' })).toContainText('Small weight');
    await expect(page.locator('app-number-input').filter({ hasText: 'Resting heart rate' })).toContainText('Not used');
  });
});
