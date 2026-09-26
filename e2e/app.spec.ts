import { expect, test } from './fixtures';

test.describe('first visit', () => {
  test('shows a prediction for a blank athlete with a wide confidence range', async ({ app, page }) => {
    await expect(app.boardDivision).toHaveText("Men's Open");
    await expect(page.locator('app-results-board .split')).toHaveCount(16);
    for (const label of ['Roxzone Time', 'Run Total', 'Work Total', 'Overall Time']) {
      await expect(page.locator('.totals')).toContainText(label);
    }
    expect(await app.confidencePct()).toBeGreaterThan(12);
    // The low–high bar is labelled so its meaning is clear (user question), and matches the confidence panel.
    await expect(page.locator('app-results-board .range-label')).toHaveText(/Likely range ±\d+%/);
    await expect(app.card('Running').locator('.q')).toHaveText('Assumed');
    await expect(app.card('Running').locator('.src')).toContainText('enter a run time');
  });

  test('stores nothing and sets no cookies by default', async ({ app, page, context }) => {
    await page.getByLabel('5K', { exact: true }).fill('22:00');
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(app).toBeTruthy();
  });

  test('makes no third-party requests and has no console errors', async ({ page }) => {
    const hosts = new Set<string>();
    const errors: string[] = [];
    page.on('request', (r) => hosts.add(new URL(r.url()).host));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    await expect(page.locator('app-results-board .clock')).toBeVisible();
    expect([...hosts]).toEqual([new URL(page.url()).host]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('700 16px "Barlow Condensed"'))).toBe(true);
  });
});

test.describe('divisions', () => {
  const divisions = [
    ["Men's Open", 1], ["Women's Open", 1], ["Men's Pro", 1], ["Women's Pro", 1], ["Men's Elite 15", 1],
    ["Women's Elite 15", 1], ['Adaptive', 1], ["Men's Doubles", 2], ["Women's Doubles", 2], ['Mixed Doubles', 2],
    ["Men's Pro Doubles", 2], ["Women's Pro Doubles", 2], ["Men's Relay", 4], ["Women's Relay", 4], ['Mixed Relay', 4],
    ['Corporate Relay', 4],
  ] as const;

  for (const [name, team] of divisions) {
    test(`${name}: predicts with ${team} athlete(s)`, async ({ app, page }) => {
      await app.division(name).click();
      await expect(app.division(name)).toHaveAttribute('aria-pressed', 'true');
      await expect(app.boardDivision).toHaveText(name);
      await expect(page.getByRole('tab')).toHaveCount(team === 1 ? 0 : team);
      await expect(page.locator('app-results-board .split')).toHaveCount(16);
      expect(await app.total()).toBeGreaterThan(30 * 60);
    });
  }

  test('Pro weights are slower than Open for the same athlete and show Pro loads', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('22:00');
    const open = await app.total();
    await expect(app.splitRow('Sled Push')).toContainText('152 kg / 335 lb');
    await app.division("Men's Pro").click();
    await expect(app.splitRow('Sled Push')).toContainText('202 kg');
    expect(await app.total()).toBeGreaterThan(open);
  });

  test('sex is fixed by the division rules and only choosable where teams pick their own mix', async ({ app, page }) => {
    const female = page.getByRole('group', { name: 'Sex' }).getByRole('button', { name: 'Female' });
    await expect(female).toBeDisabled();
    // Mixed doubles fixes the team as 1 man + 1 woman
    await app.division('Mixed Doubles').click();
    await app.tab(1).click();
    await expect(female).toHaveAttribute('aria-pressed', 'true');
    await expect(female).toBeDisabled();
    // Corporate relay lets the team choose
    await app.division('Corporate Relay').click();
    await expect(female).toBeEnabled();
  });

  test('division notes explain special rules', async ({ app, page }) => {
    await app.division('Corporate Relay').click();
    await expect(page.locator('app-division-picker .note')).toContainText('check your event rules');
  });
});

test.describe('athlete inputs & fallbacks', () => {
  test('the likely range narrows as benchmarks are added', async ({ page }) => {
    const pct = async () => Number((await page.locator('app-results-board .range-label').textContent())!.replace(/\D/g, ''));
    const before = await pct();
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByLabel('Max unbroken wall balls').fill('40');
    expect(await pct()).toBeLessThan(before);
  });

  test('entering a 5K updates the prediction and marks running as measured', async ({ app, page }) => {
    const before = await app.confidencePct();
    await page.getByLabel('5K', { exact: true }).fill('19:30');
    const fast = await app.total();
    await page.getByLabel('5K', { exact: true }).fill('29:00');
    expect(await app.total()).toBeGreaterThan(fast);
    await expect(app.card('Running').locator('.q')).toHaveText('Measured');
    expect(await app.confidencePct()).toBeLessThan(before);
  });

  test('typing a time key by key keeps exactly what was typed', async ({ app, page }) => {
    const input = page.getByLabel('5K', { exact: true });
    await input.pressSequentially('23:30', { delay: 30 });
    await expect(input).toHaveValue('23:30');
    await expect(app.card('Running').locator('.src')).toHaveText('5K 23:30');
    await input.blur();
    await expect(input).toHaveValue('23:30');
  });

  test('typing decimals, pounds, zero and reps works key by key', async ({ app, page }) => {
    const hours = page.getByLabel('Other training (hrs / week)');
    await hours.pressSequentially('7.5', { delay: 30 });
    await expect(hours).toHaveValue('7.5');
    await hours.fill('');
    await hours.pressSequentially('0');
    await expect(hours).toHaveValue('0');
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    const legs = app.card('Leg strength');
    await legs.getByLabel('Back squat (lb)').pressSequentially('225.5', { delay: 30 });
    await expect(legs.getByLabel('Back squat (lb)')).toHaveValue('225.5');
    const reps = legs.getByLabel('Back squat reps');
    await reps.fill('5');
    await reps.press('Backspace');
    await reps.pressSequentially('3');
    await expect(reps).toHaveValue('3');
    await expect(legs).toContainText('Est. 1RM');
    await page.getByLabel('Max strict pull-ups').pressSequentially('0');
    await expect(app.card('Grip').locator('.src')).toContainText('0 pull-ups');
  });

  test('implausible entries are ignored with a warning', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('0:05');
    // Flagged on the field itself and in the card summary.
    await expect(page.getByRole('alert').filter({ hasText: "00:05 isn't realistic, so it's ignored (expected 12:00–01:30:00)" })).toBeVisible();
    await expect(app.card('Running').locator('.warn').last()).toContainText('ignored');
    await expect(app.clock).toHaveText(/\d{2}:\d{2}:\d{2}/);
  });

  test('invalid time input is flagged and does not break the prediction', async ({ app, page }) => {
    const input = page.getByLabel('5K', { exact: true });
    await input.fill('4:75');
    await expect(input).toHaveClass(/invalid/);
    await expect(app.clock).toHaveText(/\d{2}:\d{2}:\d{2}/);
    await input.fill('24:10');
    await expect(input).not.toHaveClass(/invalid/);
  });

  test('running uses any race times entered, then a self-rating', async ({ app, page }) => {
    await app.card('Running').getByLabel('10K', { exact: true }).fill('48:00');
    await expect(app.card('Running').locator('.src')).toContainText('10K 48:00');
    await expect(app.card('Running').locator('.q')).toHaveText('Measured');
    await app.card('Running').getByLabel('Half marathon').fill('1:45:00');
    await expect(app.card('Running').locator('.src')).toContainText('10K 48:00 + half 1:45:00 → 5K-equivalent');
    await app.card('Running').getByLabel('10K', { exact: true }).fill('');
    await app.card('Running').getByLabel('Half marathon').fill('');
    await app.card('Running').getByRole('button', { name: 'Strong', exact: true }).click();
    await expect(app.card('Running').locator('.q')).toHaveText('Self-rated');
    await expect(app.card('Running').locator('.anchor')).toContainText('5K');
  });

  test('VO₂max estimates running when no race time is known; resting HR is no longer asked for', async ({ app, page }) => {
    await page.getByLabel('VO₂max (ml/kg/min)').fill('52');
    await expect(app.card('Running').locator('.src')).toContainText('VO₂max 52');
    await page.getByLabel('Age', { exact: true }).fill('41');
    await expect(page.getByText('HYROX age group 40–44')).toBeVisible();
    // REGRESSION: "Let's not make people enter information that is not valuable."
    await expect(page.getByLabel('Resting heart rate (bpm)')).toHaveCount(0);
    await expect(page.getByLabel('Runs straight after stations')).toHaveCount(0);
  });

  test('leg strength: rating, then a lift with reps (est. 1RM), then conversions from other lifts', async ({ app, page }) => {
    const legs = app.card('Leg strength');
    await legs.getByRole('button', { name: 'Strong', exact: true }).click();
    await expect(legs.locator('.q')).toHaveText('Self-rated');
    await expect(legs.locator('.anchor')).toContainText('1.6× bodyweight');

    await legs.getByLabel('Back squat (kg)').fill('100');
    await legs.getByLabel('Back squat reps').fill('5');
    // Default effort is "Hard (1–2 left)": 5 reps + 1.5 in reserve.
    await expect(legs.getByLabel('Back squat effort')).toHaveValue('1.5');
    await expect(legs).toContainText('Est. 1RM 122 kg');
    await legs.getByLabel('Back squat effort').selectOption({ label: 'To failure (0 left)' });
    await expect(legs).toContainText('Est. 1RM 117 kg');
    await expect(legs.locator('.q')).toHaveText('Measured');
    await expect(legs.locator('.ignored')).toBeVisible(); // rating overridden by numbers

    await legs.getByLabel('Back squat (kg)').fill('');
    await legs.getByRole('button', { name: 'Not sure', exact: true }).click();
    await app.openAlternatives('Pulling strength');
    await app.card('Pulling strength').getByLabel('Trap-bar deadlift (kg)').fill('162');
    await expect(legs.locator('.src')).toContainText('from trap-bar deadlift');
    await expect(app.card('Pulling strength').locator('.src')).toContainText('from trap-bar deadlift');
  });

  test('REGRESSION: a usual working set (no max test) estimates the 1RM from reps left in reserve', async ({ app, page }) => {
    // User: "I never do my max... three sets of about 8 to 12 reps."
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    const pull = app.card('Pulling strength');
    await expect(pull).toContainText('Your usual working set is fine');
    await expect(pull.getByLabel('Deadlift effort', { exact: true })).toHaveCount(0); // singles don't ask
    await pull.getByLabel('Deadlift (lb)', { exact: true }).fill('135');
    await pull.getByLabel('Deadlift reps', { exact: true }).fill('10');
    await expect(pull).toContainText('Est. 1RM 187 lb');
    await expect(pull.locator('.src')).toContainText('× 10 (1–2 left)');
    await pull.getByLabel('Deadlift effort', { exact: true }).selectOption({ label: 'Easy (5+ left)' });
    await expect(pull).toContainText(/Est\. 1RM 20[23] lb/); // 15.5 reps to failure, capped at 15
  });

  test('REGRESSION: impossible body fat is flagged, not silently ignored', async ({ app, page }) => {
    // User: "I changed the body fat to 114 and then 144 and it didn't have any effect at all."
    const bf = page.getByLabel('Body fat (%)');
    await bf.fill('114');
    const field = page.locator('app-number-input').filter({ hasText: 'Body fat' });
    await expect(field.getByRole('alert')).toContainText("114 isn't realistic, so it's ignored (expected 4–50)");
    await expect(bf).toHaveAttribute('aria-invalid', 'true');
    // A real value shows what it does; once lifts are entered it says it has no effect.
    await page.getByLabel('Bodyweight (kg)').fill('73.5');
    await bf.fill('14');
    await expect(field).toContainText('Estimated strength +5% vs a typical 18% athlete');
    await app.card('Leg strength').getByLabel('Back squat (kg)').fill('100');
    await app.card('Pulling strength').getByLabel('Deadlift (kg)', { exact: true }).fill('120');
    await expect(field).toContainText('No effect now');
  });

  test('REGRESSION: weights show both kg and lb', async ({ app, page }) => {
    // User: "any time something's listed as KG, should also be listed as pounds and vice versa."
    await expect(app.splitRow('Farmers')).toContainText('2 × 24 kg / 53 lb');
    const pull = app.card('Pulling strength');
    await pull.getByRole('button', { name: 'Solid', exact: true }).click();
    await page.getByLabel('Bodyweight (kg)').fill('73.5');
    await expect(pull.locator('.src')).toContainText('110 kg / 243 lb');
    await pull.getByLabel('Deadlift (kg)', { exact: true }).fill('60');
    await pull.getByLabel('Deadlift reps', { exact: true }).fill('10');
    await expect(pull).toContainText('Est. 1RM 83 kg / 183 lb');
  });

  test('kg / lb toggle converts displayed weights', async ({ page }) => {
    await page.getByLabel('Bodyweight (kg)').fill('80');
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    await expect(page.getByLabel('Bodyweight (lb)')).toHaveValue('176');
    await page.getByRole('button', { name: 'KG', exact: true }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toHaveValue('80');
  });

  test('grip, burpees, wall balls and station tests are used', async ({ app, page }) => {
    await page.getByLabel('Max dead hang (sec)').fill('90');
    await expect(app.card('Grip').locator('.src')).toContainText('dead hang 90s');
    await page.getByLabel('Max burpees in 1 minute').fill('28');
    await expect(app.card('Burpee broad jumps').locator('.src')).toContainText('28 burpees');
    await app.openAlternatives('Wall balls');
    await app.card('Wall balls').getByLabel('"Karen" (150 reps)').fill('10:00');
    await expect(app.card('Wall balls').locator('.src')).toContainText('from Karen');
    await page.getByLabel('50m sled push test').fill('2:00');
    await expect(app.splitRow('Sled Push')).toContainText('02:18');
  });

  test('confidence panel suggests the most valuable next input', async ({ page }) => {
    await expect(page.locator('.conf-tip')).toContainText('5K');
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    await expect(page.locator('.conf-tip')).not.toContainText('5K time');
  });

  test('previous HYROX result calibrates the prediction', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    const base = await app.total();
    await page.getByLabel('Previous HYROX finish (singles, same weights)').fill('1:45:00');
    expect(await app.total()).toBeGreaterThan(base);
  });
});

test.describe('team tactics', () => {
  test('REGRESSION: doubles start at 50/50, sliders stay within 20–80%, suggest and reset work', async ({ app, page }) => {
    // User: "it set some splits to 0% or 100%… by default split everything 50/50 and let us adjust."
    await app.division("Men's Doubles").click();
    const tactics = page.locator('app-team-tactics');
    await expect(tactics.getByRole('heading', { name: 'Work split' })).toBeVisible();
    for (const s of await tactics.locator('input[type=range]').all()) {
      await expect(s).toHaveValue('50');
      await expect(s).toHaveAttribute('min', '20');
      await expect(s).toHaveAttribute('max', '80');
    }
    await expect(tactics.getByRole('button', { name: 'Reset to 50/50' })).toBeDisabled();
    const slider = tactics.getByLabel('Wall Balls share for Athlete 1');
    await slider.fill('70');
    await expect(app.splitRow('Wall Balls')).toContainText('Athlete 1 70%');
    await tactics.getByRole('button', { name: 'Reset to 50/50' }).click();
    await expect(slider).toHaveValue('50');
    // A strong partner: the suggestion gives them more of the sleds, but never beyond 70%.
    await app.tab(1).click();
    await app.card('Leg strength').getByRole('button', { name: 'Elite', exact: true }).click();
    await tactics.getByRole('button', { name: 'Suggest a split' }).click();
    const push = Number(await tactics.getByLabel('Sled Push share for Athlete 1').inputValue());
    expect(push).toBeGreaterThanOrEqual(30);
    expect(push).toBeLessThan(50);
    // Runs are paced by the slower partner; an assumed pace says so.
    await expect(tactics.locator('.run-note')).toContainText('Runs are paced by');
  });

  test('doubles: each partner has their own inputs', async ({ app, page }) => {
    await app.division("Women's Doubles").click();
    await page.getByLabel('Name').fill('Sam');
    await app.tab(1).click();
    await page.getByLabel('Name').fill('Alex');
    await expect(app.tab(0)).toContainText('Sam');
    await expect(app.tab(1)).toContainText('Alex');
  });

  test('relay: pick an athlete per leg, then auto-choose the fastest order', async ({ app, page }) => {
    await app.division("Men's Relay").click();
    const tactics = page.locator('app-team-tactics');
    const leg1 = tactics.locator('.leg').first().locator('select');
    await leg1.selectOption({ label: 'Athlete 4' });
    await expect(app.splitRow('1000m SkiErg')).toContainText('Athlete 4');
    await tactics.getByRole('button', { name: 'Auto (fastest)' }).click();
    await expect(tactics).toContainText('Showing the fastest order');
  });
});

test.describe('results board', () => {
  test('lock a station time, then reset it', async ({ app, page }) => {
    const row = app.splitRow('Wall Balls');
    await row.getByRole('button', { name: /Set your own/ }).click();
    const input = row.locator('input.edit');
    await input.fill('5:00');
    await input.press('Enter');
    await expect(row).toContainText('05:00');
    await expect(row).toHaveClass(/locked/);
    await row.getByRole('button', { name: 'Reset to predicted time' }).click();
    await expect(row).not.toHaveClass(/locked/);
  });

  test('race simulator plays and stops', async ({ page }) => {
    const board = page.locator('app-results-board');
    await board.getByRole('button', { name: /Simulate/ }).click();
    await expect(board.locator('.sim-now')).toBeVisible();
    await expect(board.locator('.marker')).toBeVisible();
    await board.getByRole('button', { name: /Stop/ }).click();
    await expect(board.locator('.field-pos')).toBeVisible();
  });

  test('methodology section expands', async ({ page }) => {
    await page.getByText('How the prediction works').click();
    await expect(page.getByText('Missing data? Every ability has fallbacks')).toBeVisible();
    // Keep the in-app methodology in sync with the model (see CLAUDE.md rule 5).
    const body = page.locator('app-methodology .body');
    for (const phrase of ['5K, 10K, half marathon, marathon', 'Weekly running distance', 'mostly fitness, not inexperience',
      'Other training hours', 'Insights', 'Simulator', 'athletes like you', 'No max test needed', 'hand-over tips', 'Suggest a split']) {
      await expect(body).toContainText(phrase);
    }
  });
});

test.describe('saving & reset', () => {
  test('opt-in save survives a reload; opting out deletes it', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:45');
    await page.getByText('Save my inputs on this device').click();
    // Saving runs in an effect after the click; poll instead of reading once (this raced in CI).
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage))).toEqual(['hyrox-predictor:saved']);
    await page.reload();
    await expect(page.getByLabel('5K', { exact: true })).toHaveValue('21:45');
    await expect(page.getByRole('checkbox', { name: /Save my inputs/ })).toBeChecked();
    await page.getByText('Save my inputs on this device').click();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await page.reload();
    await expect(page.getByLabel('5K', { exact: true })).toHaveValue('');
  });

  test('reset clears inputs after confirmation', async ({ page }) => {
    await page.getByLabel('5K', { exact: true }).fill('21:45');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByLabel('5K', { exact: true })).toHaveValue('');
  });
});

test.describe('responsive layout', () => {
  test('no horizontal scrolling', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('phone: summary dock jumps to the splits', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'dock is phone/tablet only');
    const dock = page.getByRole('region', { name: 'Predicted finish summary' });
    await expect(dock).toBeVisible();
    await dock.getByRole('button', { name: 'View splits' }).click();
    await expect(page.locator('app-results-board .board-head')).toBeInViewport();
  });

  test('desktop: results stay visible beside the form', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'desktop only');
    await expect(page.getByRole('region', { name: 'Predicted finish summary' })).toBeHidden();
    await page.getByText('How the prediction works').scrollIntoViewIfNeeded();
    await expect(page.locator('app-results-board .clock')).toBeInViewport();
  });
});

test.describe('steppers and validation (user: "freeform text boxes… plus or minus, and validation")', () => {
  const field = (page: import('@playwright/test').Page, label: string) =>
    page.locator('app-number-input, app-time-input').filter({ has: page.getByLabel(label, { exact: true }) });

  test('− / + buttons step numbers from a sensible start, snap to the step and stop at the limits', async ({ page }) => {
    const age = field(page, 'Age');
    await age.getByRole('button', { name: 'Increase' }).click();
    await expect(page.getByLabel('Age', { exact: true })).toHaveValue('35');
    await age.getByRole('button', { name: 'Increase' }).click();
    await expect(page.getByLabel('Age', { exact: true })).toHaveValue('36');
    await age.getByRole('button', { name: 'Decrease' }).click();
    await expect(page.getByLabel('Age', { exact: true })).toHaveValue('35');
    await expect(page.getByLabel('Age', { exact: true })).toHaveAttribute('role', 'spinbutton');
    await page.getByLabel('Age', { exact: true }).fill('95');
    await expect(age.getByRole('button', { name: 'Increase' })).toBeDisabled();

    const bw = field(page, 'Bodyweight (kg)');
    await page.getByLabel('Bodyweight (kg)').fill('73.3');
    await bw.getByRole('button', { name: 'Increase' }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toHaveValue('73.5'); // snaps to 0.5 kg
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    await field(page, 'Bodyweight (lb)').getByRole('button', { name: 'Increase' }).click();
    await expect(page.getByLabel('Bodyweight (lb)')).toHaveValue('163'); // 1 lb steps
  });

  test('arrow keys step (Shift × 10) and time fields step in seconds', async ({ app, page }) => {
    const fiveK = page.getByLabel('5K', { exact: true });
    await field(page, '5K').getByRole('button', { name: 'Increase' }).click();
    await expect(fiveK).toHaveValue('25:00');
    await fiveK.press('ArrowUp');
    await expect(fiveK).toHaveValue('25:05');
    await fiveK.press('Shift+ArrowDown');
    await expect(fiveK).toHaveValue('24:15');
    await expect(app.card('Running').locator('.src')).toContainText('5K 24:15');
    const hours = page.getByLabel('Other training (hrs / week)');
    await hours.fill('5');
    await hours.press('ArrowUp');
    await expect(hours).toHaveValue('5.5');
  });

  test('press and hold repeats', async ({ page }) => {
    const plus = field(page, 'Max unbroken wall balls').getByRole('button', { name: 'Increase' });
    await plus.scrollIntoViewIfNeeded();
    const box = (await plus.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    const v = Number(await page.getByLabel('Max unbroken wall balls').inputValue());
    expect(v).toBeGreaterThanOrEqual(30 + 5 * 3); // starts at 30, then repeats every 70 ms after 450 ms
  });

  test('out-of-range numbers are flagged on the field and ignored', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    const before = await app.total();
    await page.getByLabel('Age', { exact: true }).fill('150');
    await expect(page.getByRole('alert').filter({ hasText: "150 isn't realistic, so it's ignored (expected 16–95)" })).toBeVisible();
    await page.getByLabel('Max unbroken wall balls').fill('900');
    await expect(page.getByRole('alert').filter({ hasText: '900 isn' })).toBeVisible();
    expect(await app.total()).toBe(before);
  });
});
