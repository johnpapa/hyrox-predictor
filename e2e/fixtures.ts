import { Page, expect, test as base } from '@playwright/test';

/** Parse "01:29:10" / "29:10" into seconds. */
export function toSec(t: string): number {
  const parts = t.trim().split(':').map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export class App {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('./');
    await expect(this.clock).toHaveText(/\d{2}:\d{2}:\d{2}/);
  }

  get clock() {
    return this.page.locator('app-results-board .clock');
  }

  get boardDivision() {
    return this.page.locator('app-results-board .div-name');
  }

  get confidence() {
    return this.page.locator('.conf-pct');
  }

  async total(): Promise<number> {
    return toSec((await this.clock.textContent()) ?? '');
  }

  async confidencePct(): Promise<number> {
    return Number(((await this.confidence.textContent()) ?? '').replace(/[^\d.]/g, ''));
  }

  division(name: string) {
    return this.page.locator('app-division-picker').getByRole('button', { name, exact: true });
  }

  card(heading: string) {
    return this.page.locator('app-ability-card').filter({ has: this.page.getByRole('heading', { name: heading, exact: true }) });
  }

  async openAlternatives(heading: string): Promise<void> {
    const card = this.card(heading);
    const details = card.locator('details');
    if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
      await card.getByText("Don't have that? Other ways to estimate").click();
    }
  }

  splitRow(label: string) {
    return this.page.locator('app-results-board .split').filter({ hasText: label });
  }

  tab(n: number) {
    return this.page.getByRole('tab').nth(n);
  }
}

/** Every test starts on a freshly loaded app (auto fixture), whether or not it uses `app`. */
export const test = base.extend<{ app: App }>({
  app: [
    async ({ page }, use) => {
      const app = new App(page);
      await app.open();
      await use(app);
    },
    { auto: true },
  ],
});

export { expect };
