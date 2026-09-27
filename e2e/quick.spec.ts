import { expect, test } from './fixtures';

/**
 * Quick view (user: "only show the 10 or less fields that are the most important… the same fields,
 * in the same units, as the long form").
 */
test.describe('quick view', () => {
  test.use({ formMode: 'quick' });

  test('new visitors land in Quick, which shows at most 10 inputs', async ({ page }) => {
    const panel = page.locator('#athlete-panel');
    await expect(page.getByRole('group', { name: 'Form view' }).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true');
    const fields = await panel.locator('input:not([type=range]):visible, select:visible').count();
    const groups = await panel.locator('[role=group][aria-label="Sex"]:visible, [role=group][aria-label$="self-assessment"]:visible').count();
    expect(fields + groups).toBeLessThanOrEqual(10); // 9 here: Men's Open decides the sex
    for (const label of ['Bodyweight (kg)', 'Age', 'Weekly running (km)', '5K', 'Usual set size for 100 reps']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    for (const label of ['Name', 'Height (cm)', 'VO₂max (ml/kg/min)', 'Body fat (%)', '10K', 'Row 1000m best', 'Other training (hrs / week)', 'Max unbroken wall balls']) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    await expect(panel.getByRole('group', { name: 'Leg strength self-assessment' })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Pulling strength self-assessment' })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Wall balls self-assessment' })).toHaveCount(0);
  });

  test('Quick and Detailed edit the same fields in the same units', async ({ page }) => {
    await page.getByRole('button', { name: 'LB', exact: true }).click();
    await page.getByLabel('Weekly running (mi)').fill('40');
    await page.getByLabel('Bodyweight (lb)').fill('162');
    await page.getByLabel('5K', { exact: true }).fill('21:08');
    await page.getByRole('group', { name: 'Form view' }).getByRole('button', { name: 'Detailed' }).click();
    await expect(page.getByLabel('Weekly running (mi)')).toHaveValue('40');
    await expect(page.getByLabel('Bodyweight (lb)')).toHaveValue('162');
    await expect(page.getByLabel('5K', { exact: true })).toHaveValue('21:08');
  });

  test('details entered in Detailed stay in use and are listed in Quick', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    await page.getByRole('group', { name: 'Form view' }).getByRole('button', { name: 'Detailed' }).click();
    await page.getByLabel('Height (cm)').fill('201');
    const withHeight = await app.total();
    await page.getByRole('group', { name: 'Form view' }).getByRole('button', { name: 'Quick' }).click();
    await expect(page.locator('.quick-foot')).toContainText('Also using from Detailed: height');
    expect(await app.total()).toBe(withHeight);
  });

  test('the confidence tip only points at fields you can see, or says to switch', async ({ page }) => {
    await expect(page.locator('.conf-tip')).toContainText('Enter your 5K');
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    await expect(page.locator('.conf-tip')).not.toContainText('Add a 1000m');
    // Unfilled Quick fields come before anything that needs Detailed.
    await expect(page.locator('.conf-tip')).not.toContainText('Switch to Detailed');
    await page.locator('app-ability-card').filter({ hasText: 'Leg strength' }).getByRole('button', { name: 'Solid', exact: true }).click();
    await page.locator('app-ability-card').filter({ hasText: 'Pulling strength' }).getByRole('button', { name: 'Solid', exact: true }).click();
    await page.getByLabel('Usual set size for 100 reps').fill('20');
    await expect(page.locator('.conf-tip')).toContainText(/Switch to Detailed|well covered/);
  });

  test('saved data that uses detailed fields opens in Detailed', async ({ page }) => {
    await page.addInitScript(() => {
      const a = { sex: 'male', heightCm: 180, fiveKSec: 1400 };
      localStorage.setItem('hyrox-predictor:saved', JSON.stringify({ v: 1, divisionId: 'men-open', athletes: [a], units: 'kg', doublesShares: {}, relayOrder: null, overrides: {} }));
    });
    await page.reload();
    await expect(page.getByRole('group', { name: 'Form view' }).getByRole('button', { name: 'Detailed' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Height (cm)')).toHaveValue('180');
  });
});
