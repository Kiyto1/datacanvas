import { expect, test, type Page } from '@playwright/test';

const csv =
  'التاريخ,المدينة,المنتج,المبيعات\n2026/01/01,الرياض,حاسب محمول,"5,000"\n2026/01/02,جدة,هاتف,"3,500"\n2026/01/03,المدينة المنورة,حاسب محمول,"4,200"\n';

async function upload(page: Page, name: string, content: string) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content, 'utf8') });
}

test('builds an Arabic dashboard from the sales table with no CSP violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Content Security Policy')) violations.push(msg.text());
  });
  await upload(page, 'sales.csv', csv);

  await expect(page.getByTestId('dashboard')).toBeVisible();
  await expect(page.getByTestId('kpi-kpi:records')).toHaveText('3');
  await expect(page.getByTestId('kpi-kpi:c3:sum')).toHaveText(/12[,٬]?700/);
  // Arabic titles generated from the columns, no renaming needed.
  await expect(page.getByRole('heading', { name: 'إجمالي المبيعات حسب المدينة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إجمالي المبيعات حسب المنتج' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اتجاه إجمالي المبيعات خلال الفترة' })).toBeVisible();
  // Charts actually rendered to canvas.
  await expect(page.locator('canvas').first()).toBeVisible();
  expect(violations).toEqual([]);
});

test('clicking a category cross-filters the KPIs and can be cleared', async ({ page }) => {
  await upload(page, 'sales.csv', csv);
  await expect(page.getByTestId('kpi-kpi:c3:sum')).toHaveText(/12[,٬]?700/);

  // The table view is the accessible way to pick a category (same filter as clicking a bar).
  await page.getByTestId('table-toggle-bar:c1:c3').click();
  await page.getByTestId('filter-bar:c1:c3-الرياض').click();

  await expect(page.getByTestId('kpi-kpi:c3:sum')).toHaveText(/5[,٬]?000/);
  await expect(page.getByTestId('kpi-kpi:records')).toHaveText('1');
  await expect(page.getByTestId('filter-bar')).toContainText('الرياض');

  await page.getByTestId('clear-filters').click();
  await expect(page.getByTestId('kpi-kpi:c3:sum')).toHaveText(/12[,٬]?700/);
  await expect(page.getByTestId('filter-bar')).toHaveCount(0);
});

test('merged city names flow into the dashboard and undo restores them', async ({ page }) => {
  const cities = 'المدينة,المبيعات\nالرياض,"5,000"\nRiyadh,"3,000"\nالرّياض,"2,000"\nجدة,"4,000"\nJeddah,"2,500"\n';
  await upload(page, 'cities.csv', cities);

  await page.getByTestId('table-toggle-bar:c0:c1').click();
  await expect(page.getByTestId('filter-bar:c0:c1-Riyadh')).toBeVisible();

  await page.getByTestId('suggestion-check-0').check();
  await page.getByTestId('suggestion-check-1').check();
  await page.getByTestId('normalize-apply').click();
  await expect(page.getByTestId('normalize-status')).toBeVisible();

  await expect(page.getByTestId('filter-bar:c0:c1-Riyadh')).toHaveCount(0);
  await expect(page.getByTestId('filter-bar:c0:c1-الرياض')).toBeVisible();

  await page.getByTestId('normalize-undo').click();
  await expect(page.getByTestId('filter-bar:c0:c1-Riyadh')).toBeVisible();
});

test('asks which date order is meant instead of guessing, then draws the trend', async ({ page }) => {
  await upload(page, 'dates.csv', 'التاريخ,المبيعات\n03/04/2026,100\n05/06/2026,200\n01/02/2026,300\n');
  await expect(page.getByTestId('date-warning')).toBeVisible();
  await expect(page.getByRole('heading', { name: /اتجاه/ })).toHaveCount(0);

  await page.getByTestId('date-choice-c0-dmy-gregorian').click();
  await expect(page.getByTestId('date-warning')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'اتجاه إجمالي المبيعات خلال الفترة' })).toBeVisible();
});
