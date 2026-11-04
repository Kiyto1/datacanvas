import { expect, test, type Page } from '@playwright/test';

const csv =
  'التاريخ,المدينة,المنتج,المبيعات\n2026/01/01,الرياض,حاسب محمول,"5,000"\n2026/01/02,جدة,هاتف,"3,500"\n2026/01/03,المدينة المنورة,حاسب محمول,"4,200"\n';

async function upload(page: Page, content = csv) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from(content, 'utf8') });
  await expect(page.getByTestId('dashboard')).toBeVisible();
}

test('the hero demo runs the real merge engine and can be driven by hand', async ({ page }) => {
  await page.goto('/');
  const demo = page.getByTestId('hero-demo');
  await expect(demo).toBeVisible();

  await page.getByTestId('hero-demo-after').click();
  await expect(demo).toHaveAttribute('data-phase', 'after');
  // 6 spellings in the sample rows collapse to 3 cities (Arabic, Latin and diacritic variants merged).
  await expect(page.getByTestId('hero-demo-message')).toContainText('3 مدن بدل 6');

  await page.getByTestId('hero-demo-before').click();
  await expect(demo).not.toHaveAttribute('data-phase', 'after');
  await expect(demo.getByText('Riyadh').first()).toBeVisible();
});

test('"try sample data" opens a full workspace with cleanup suggestions waiting', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('try-demo').click();

  await expect(page.getByTestId('dashboard')).toBeVisible();
  // Regression: a view transition that waits on a frame freezes every entrance animation for seconds.
  await expect(page.getByTestId('kpi-strip')).toHaveCSS('opacity', '1', { timeout: 2500 });
  await expect(page.getByTestId('file-pill')).toContainText('مبيعات-تجريبية.csv');
  await expect(page.getByTestId('tray')).toBeVisible();
  await expect(page.getByTestId('suggestion-0')).toBeVisible();
  await expect(page.getByTestId('review-count')).not.toHaveText('0');
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('a filter shows each KPI as a share of the whole', async ({ page }) => {
  await upload(page);
  await page.getByTestId('table-toggle-bar:c1:c3').click();
  await page.getByTestId('filter-bar:c1:c3-الرياض').click();
  await expect(page.getByTestId('kpi-kpi:c3:sum')).toHaveText(/5[,٬]?000/);
  await expect(page.getByTestId('kpi-share-kpi:c3:sum')).toContainText('من إجمالي');
  await expect(page.getByTestId('kpi-share-kpi:c3:sum')).toContainText(/12[,٬]?700/);
  await page.getByTestId('clear-filters').click();
  await expect(page.getByTestId('kpi-share-kpi:c3:sum')).toHaveText('');
});

test('a chart can be customised from its own panel, reset, and hidden', async ({ page }) => {
  await upload(page);
  const panel = page.getByTestId('panel-bar:c1:c3');
  await expect(panel.getByRole('heading', { name: 'إجمالي المبيعات حسب المدينة' })).toBeVisible();

  await page.getByTestId('edit-bar:c1:c3').click();
  await page.getByTestId('editor-dimension-bar:c1:c3').selectOption('c2'); // group by product instead
  await expect(page.getByRole('heading', { name: 'إجمالي المبيعات حسب المنتج' }).first()).toBeVisible();

  await page.getByTestId('editor-agg-bar:c1:c3').selectOption('avg');
  await expect(page.getByRole('heading', { name: 'متوسط المبيعات حسب المنتج' })).toBeVisible();

  await page.getByTestId('editor-reset-bar:c1:c3').click();
  await expect(page.getByRole('heading', { name: 'إجمالي المبيعات حسب المدينة' })).toBeVisible();

  await page.getByTestId('editor-hide-bar:c1:c3').click();
  await expect(page.getByTestId('panel-bar:c1:c3')).toHaveCount(0);
  await page.getByTestId('show-hidden').click();
  await expect(page.getByTestId('panel-bar:c1:c3')).toBeVisible();
});

test('the editor never offers to sum a unit price or use an identifier as a measure', async ({ page }) => {
  const rows = Array.from({ length: 30 }, (_, i) => `${1000 + i},${10 + (i % 7)},x${i % 3},${i}`).join('\n');
  await upload(page, `رقم الموظف,سعر الوحدة,النوع,الكمية\n${rows}\n`);
  const barId = await page.locator('[data-testid^="edit-bar:"]').first().getAttribute('data-testid');
  await page.locator('[data-testid^="edit-bar:"]').first().click();
  const id = barId!.replace('edit-', '');
  const measures = await page.getByTestId(`editor-measure-${id}`).locator('option').allInnerTexts();
  expect(measures.join('|')).not.toContain('رقم الموظف');
  await page.getByTestId(`editor-measure-${id}`).selectOption({ label: 'سعر الوحدة' });
  const aggs = await page.getByTestId(`editor-agg-${id}`).locator('option').allInnerTexts();
  expect(aggs).not.toContain('إجمالي');
});

test('the cleanup tray and the data tab can be opened and closed', async ({ page }) => {
  await upload(page, 'المدينة,المبيعات\nالرياض,"5,000"\nRiyadh,"3,000"\nجدة,"4,000"\n');
  await expect(page.getByTestId('tray')).toBeVisible();
  await page.getByTestId('tray-close').click();
  await expect(page.getByTestId('tray')).toHaveCount(0);
  await page.getByTestId('tray-toggle').click();
  await expect(page.getByTestId('tray')).toBeVisible();

  await page.getByTestId('tab-data').click();
  await expect(page.getByTestId('data-view')).toBeVisible();
  await page.getByTestId('tab-dashboard').click();
  await expect(page.getByTestId('dashboard')).toBeVisible();
});

test('"new file" returns to the landing page', async ({ page }) => {
  await upload(page);
  await page.getByTestId('new-file').click();
  await expect(page.getByRole('heading', { name: 'بياناتك، بصورة أوضح.' })).toBeVisible();
  await expect(page.getByTestId('file-input')).toBeAttached();
});
