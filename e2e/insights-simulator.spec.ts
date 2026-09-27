import { expect, test } from './fixtures';

test.describe('insights panel', () => {
  test('shows limiters, time savings and pacing that react to inputs', async ({ page }) => {
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.bar-row')).toHaveCount(9);
    await expect(panel.locator('.hint')).toBeVisible(); // nothing entered yet
    await page.getByLabel('5K', { exact: true }).fill('22:30');
    await page.getByLabel('Usual set size for 100 reps').fill('7');
    await expect(panel.locator('.headline')).toContainText('Wall Balls');
    await expect(panel.locator('.hint')).toBeHidden();
    await expect(panel.locator('.whatifs li').first()).toBeVisible();
    await expect(panel.locator('.whatifs')).toContainText('Sets of 7 → 10 for 100 reps');
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
    await page.getByLabel('Bodyweight (lb)').fill('170');
    await bw.getByRole('button', { name: 'Kilograms' }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toHaveValue('77.1');
    await expect(app.card('Leg strength').getByLabel('Back squat (kg)')).toBeVisible();
    await app.card('Leg strength').getByRole('button', { name: 'Pounds' }).click();
    await expect(app.card('Leg strength').getByLabel('Back squat (lb)')).toBeVisible();
  });

  test('every change flashes how much it moved the finish time', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('24:00');
    await page.getByLabel('5K', { exact: true }).fill('22:00');
    await expect(page.locator('app-results-board app-change-chip .chip')).toContainText('faster');
    await page.getByLabel('Usual set size for 100 reps').fill('6');
    await expect(page.locator('app-results-board app-change-chip .chip')).toContainText('slower');
  });

  test('the finish time stays visible while editing (top bar on phone, floating pill on desktop)', async ({ page, isMobile }) => {
    const dock = page.getByRole('region', { name: 'Predicted finish summary' });
    if (isMobile) {
      await page.getByText('Save my inputs on this device').scrollIntoViewIfNeeded();
      await expect(page.getByRole('region', { name: 'Predicted finish', exact: true })).toBeInViewport();
    } else {
      await expect(dock).toBeHidden(); // board clock is on screen
      await page.locator('aside.results').evaluate((el) => el.scrollTo(0, 5000));
      await expect(dock).toBeVisible();
      await page.getByLabel('5K', { exact: true }).fill('21:30');
      await expect(dock.locator('.dock-time')).toHaveText(/\d{2}:\d{2}:\d{2}/);
      await expect(dock.locator('app-change-chip .chip')).toBeVisible();
    }
  });

  test('marathon time is accepted and shapes the running estimate', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:30');
    await app.card('Running').getByLabel('Marathon', { exact: true }).fill('3:28:00');
    await expect(app.card('Running')).toContainText('Endurance: typical');
    await expect(app.card('Running').locator('.src')).toContainText('5K 21:30 + marathon 3:28:00');
  });
});

test.describe('honest suggestions & height', () => {
  test('REGRESSION: "Not sure" strength shows as worth measuring, never as a made-up kg target', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:30');
    const panel = page.locator('app-insights-panel');
    await expect(panel.locator('.unknowns')).toContainText('Enter a deadlift working set');
    await expect(panel.locator('.unknowns')).toContainText('Enter a squat working set');
    await expect(panel.locator('.whatifs')).not.toContainText('kg');
  });

  test('height can be entered in cm or inches', async ({ app, page }) => {
    await page.getByLabel('Height (cm)').fill('180');
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    await expect(page.getByLabel('Height (in)')).toHaveValue('71');
    await expect(page.locator('app-number-input').filter({ hasText: 'Height' })).toContainText('5′11″');
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
  test('tap a station to see the reasons; overall reasons are summarised', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:30');
    await page.getByLabel('Bodyweight (kg)').fill('76');
    await app.openAlternatives('Wall balls');
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
    // The comparison athlete shares height, weight, race times, age and training; only trainable abilities differ.
    await page.getByLabel('5K', { exact: true }).fill('21:30');
    await page.getByLabel('Bodyweight (kg)').fill('76');
    await page.getByLabel('Age', { exact: true }).fill('53');
    const panel = page.locator('app-insights-panel');
    await expect(panel.getByRole('heading', { name: 'Vs. athletes like you' })).toBeVisible();
    await expect(panel).toContainText('share your sex, age, height, weight');
    // Bodyweight no longer makes the sled look slower; it is listed under build instead.
    await expect(panel.getByRole('button', { name: /Sled Push ±0:00/ })).toBeDisabled();
    await expect(panel.locator('.profile')).toContainText('Lighter bodyweight');
    await expect(panel.locator('.profile')).toContainText('Age 53');
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
    await page.getByLabel('5K', { exact: true }).fill('21:30');
    await page.getByLabel('Age', { exact: true }).fill('53');
    await expect(page.locator('app-results-board .field-pos')).toContainText('of Men 50–54');
    await page.getByRole('link', { name: 'Simulator' }).click();
    await expect(page.locator('app-simulator-page .pos')).toContainText('Men 50–54');
  });

  test('body fat is used for estimated strength and explained', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:30');
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

  test('VO₂max says it only gets a small weight once a race time is entered', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    await expect(page.locator('app-number-input').filter({ hasText: 'VO₂max' })).toContainText('Small weight');
  });

  test('every input says which part of the race it is used for', async ({ app, page }) => {
    await expect(page.locator('app-number-input').filter({ has: page.getByLabel('Weekly running (km)') })).toContainText('Used for: All 8 runs');
    await expect(page.locator('app-number-input').filter({ has: page.getByLabel('Bodyweight (kg)') })).toContainText('Used for: Sleds');
    await expect(app.card('Pulling strength').locator('.uses')).toContainText('Sled Pull · Farmers Carry');
    await expect(app.card('Wall balls').locator('.uses')).toContainText('Wall Balls');
    expect(await page.locator('app-ability-card .uses').count()).toBe(10);
  });
});

test.describe('simulator: what it simulates and how to use it', () => {
  test('says which division and format it simulates, with team names for doubles', async ({ app, page }) => {
    await page.getByRole('link', { name: 'Simulator' }).click();
    const status = page.locator('app-simulator-page .simulating');
    await expect(status).toContainText("Singles · Men's Open");
    await page.getByRole('link', { name: 'Change' }).click();
    await app.division('Mixed Doubles').click();
    await page.getByRole('link', { name: 'Simulator' }).click();
    await expect(status).toContainText('Doubles · Mixed Doubles');
    await expect(status).toContainText('Athlete 1 & Athlete 2 · team times');
    await expect(page.locator('app-simulator-page .help')).toContainText("each station is the pair's time");
  });

  test('explains how to use it, and the explanation can be collapsed', async ({ page }) => {
    await page.getByRole('link', { name: 'Simulator' }).click();
    const help = page.locator('app-simulator-page .help');
    await expect(help).toContainText('Change one split');
    await expect(help).toContainText('Work back from a goal');
    const toggle = help.getByRole('button', { name: 'How to use the simulator' });
    await toggle.click();
    await expect(help.getByText('Change one split')).toBeHidden();
  });
});
