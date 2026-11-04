import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    // The theme is the app's own switch (light is the default), so set the stored choice rather than the OS scheme.
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('datacanvas.theme', t), scheme);
    });

    test('landing page has no serious accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('hero-demo').waitFor();
      await page.getByTestId('hero-demo-after').click(); // stop the autoplay so the scan is stable
      // Walk the whole page so lazy sections mount and scroll reveals finish before scanning.
      await page.locator('#live').scrollIntoViewIfNeeded();
      await page.getByTestId('live-demo').waitFor({ timeout: 15000 });
      await page.locator('#how').scrollIntoViewIfNeeded();
      await page.locator('#privacy').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      expect(await violations(page)).toEqual([]);
    });

    test('workspace (dashboard, open tray, popovers) has no serious accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('try-demo').click();
      await page.getByTestId('dashboard').waitFor();
      await page.locator('canvas').first().waitFor();
      await page.waitForTimeout(1200);
      expect(await violations(page)).toEqual([]);

      await page.locator('[data-testid^="edit-bar:"]').first().click();
      await page.waitForTimeout(300);
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      await page.getByTestId('export-open').click();
      await page.waitForTimeout(300);
      expect(await violations(page)).toEqual([]);
    });

    test('data tab has no serious accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('try-demo').click();
      await page.getByTestId('tab-data').click();
      await page.getByTestId('data-view').waitFor();
      await page.waitForTimeout(500);
      expect(await violations(page)).toEqual([]);
    });
  });
}
