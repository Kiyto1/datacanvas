import { expect, test } from '@playwright/test';

const csv =
  'التاريخ,المدينة,المنتج,المبيعات\n2026/01/01,الرياض,حاسب محمول,"5,000"\n2026/01/02,جدة,هاتف,"3,500"\n2026/01/03,المدينة المنورة,حاسب محمول,"4,200"\n';

test('uploads an Arabic CSV, parses it in a worker and shows a preview', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('http://localhost:4173') && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
  });

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  await page.getByTestId('tab-data').click();
  await expect(page.getByTestId('dataset-title')).toHaveText('sales.csv');
  await expect(page.getByTestId('dataset-counts')).toContainText('3');
  await expect(page.getByRole('columnheader', { name: 'المبيعات' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'المدينة المنورة' })).toBeVisible();
  // Profiling: date and measure are detected without renaming columns.
  await expect(page.getByTestId('col-c0')).toContainText('تاريخ');
  await expect(page.getByTestId('col-c3')).toContainText('رقم');
  await expect(page.getByTestId('col-c3')).toContainText('قيمة قابلة للقياس');
  await expect(page.getByTestId('date-warning')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('warns when day/month order is ambiguous instead of guessing', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'dates.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('التاريخ,المبيعات\n03/04/2026,100\n05/06/2026,200\n', 'utf8'),
  });
  await expect(page.getByTestId('date-warning')).toBeVisible();
});

test('shows a friendly error for an unsupported file', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4', 'utf8'),
  });
  await expect(page.getByTestId('upload-error')).toContainText('غير مدعوم');
});
