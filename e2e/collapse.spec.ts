import { expect, test } from './fixtures';

/** Long sections collapse from their title (arrow), and nothing entered is lost. */
test.describe('collapsible sections', () => {
  test('an ability card collapses from its title, keeping its summary line', async ({ app, page }) => {
    const legs = app.card('Leg strength');
    const title = legs.getByRole('button', { name: 'Leg strength', exact: true });
    await expect(title).toHaveAttribute('aria-expanded', 'true');
    await expect(legs.getByLabel('Back squat (kg)')).toBeVisible();
    await title.click();
    await expect(title).toHaveAttribute('aria-expanded', 'false');
    await expect(legs.getByLabel('Back squat (kg)')).toBeHidden();
    await expect(legs.getByRole('group', { name: 'Leg strength self-assessment' })).toBeHidden();
    await expect(legs.locator('.src')).toBeVisible(); // still shows what's being used
    await title.click();
    await expect(legs.getByLabel('Back squat (kg)')).toBeVisible();
  });

  test('values survive collapsing and still count', async ({ app, page }) => {
    await page.getByLabel('5K', { exact: true }).fill('23:00');
    const title = app.card('Running').getByRole('button', { name: 'Running', exact: true });
    await title.click();
    await expect(app.card('Running').locator('.src')).toContainText('5K 23:00');
    await title.click();
    await expect(page.getByLabel('5K', { exact: true })).toHaveValue('23:00');
  });

  test('collapse all / expand all cards', async ({ page }) => {
    await page.getByRole('button', { name: 'Collapse all' }).click();
    const titles = page.locator('app-ability-card h3 button');
    for (const t of await titles.all()) await expect(t).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Expand all' }).click();
    for (const t of await titles.all()) await expect(t).toHaveAttribute('aria-expanded', 'true');
  });

  test('profile, division, work split and insights sections collapse too', async ({ app, page }) => {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toBeHidden();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.getByLabel('Bodyweight (kg)')).toBeVisible();

    const picker = page.locator('app-division-picker');
    await picker.getByRole('button', { name: 'Division', exact: true }).click();
    await expect(app.division("Women's Open")).toBeHidden();
    await expect(picker.locator('.current')).toHaveText("Men's Open");
    await picker.getByRole('button', { name: 'Division', exact: true }).click();

    await app.division("Men's Doubles").click();
    const tactics = page.locator('app-team-tactics');
    await tactics.getByRole('button', { name: 'Work split', exact: true }).click();
    await expect(tactics.getByLabel('Wall Balls share for Athlete 1')).toBeHidden();

    const insights = page.locator('app-insights-panel');
    await insights.getByRole('button', { name: 'Practical tips', exact: true }).click();
    await expect(insights.locator('ul.tips').first()).toBeHidden();
    await expect(insights.getByRole('button', { name: 'Practical tips', exact: true })).toHaveAttribute('aria-expanded', 'false');
  });

  test('every collapsible section says "Collapse" / "Expand" in text, not just the arrow', async ({ app, page }) => {
    const legs = app.card('Leg strength');
    const title = legs.getByRole('button', { name: 'Leg strength', exact: true });
    await expect(title).toContainText('Collapse');
    await title.click();
    await expect(title).toContainText('Expand');
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toContainText('Collapse');
    const method = page.locator('app-methodology summary');
    await expect(method).toContainText('Expand');
    await method.click();
    await expect(method).toContainText('Collapse');
    await expect(page.locator('#disclaimer summary')).toContainText('Expand');
  });
});
