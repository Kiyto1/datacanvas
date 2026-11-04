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

  await expect(page.getByTestId('dataset-title')).toHaveText('sales.csv');
  await expect(page.getByTestId('dataset-counts')).toContainText('3');
  await expect(page.getByRole('columnheader', { name: 'المبيعات' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'المدينة المنورة' })).toBeVisible();
  expect(external).toEqual([]);
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
