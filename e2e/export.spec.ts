import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const csv =
  'التاريخ,المدينة,المنتج,المبيعات\n2026/01/01,الرياض,حاسب محمول,"5,000"\n2026/01/02,Riyadh,هاتف,"3,500"\n2026/01/03,جدة,حاسب محمول,"-1,200"\n';

async function upload(page: Page, content: string) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from(content, 'utf8') });
  await expect(page.getByTestId('export-panel')).toBeVisible();
}

async function download(page: Page, testId: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path) };
}

test('downloads a cleaned CSV that reflects approved merges, with BOM and typed numbers', async ({ page }) => {
  await upload(page, csv);
  await page.getByTestId('suggestion-check-0').check();
  await page.getByTestId('normalize-apply').click();
  await expect(page.getByTestId('normalize-status')).toBeVisible();

  const file = await download(page, 'export-csv');
  expect(file.name).toBe('sales-cleaned.csv');
  expect([...file.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = file.bytes.subarray(3).toString('utf8');
  expect(text).toContain('التاريخ,المدينة,المنتج,المبيعات');
  expect(text).toContain('2026-01-01,الرياض,حاسب محمول,5000');
  expect(text).toContain('2026-01-02,الرياض,هاتف,3500'); // Riyadh merged
  expect(text).toContain('2026-01-03,جدة,حاسب محمول,-1200'); // negative stays a plain number
  await expect(page.getByTestId('export-done')).toContainText('sales-cleaned.csv');
});

test('downloads the Power BI package as a zip with the promised files', async ({ page }) => {
  await upload(page, csv);
  const file = await download(page, 'export-powerbi');
  expect(file.name).toBe('sales-powerbi.zip');
  const zip = file.bytes;
  expect(zip.readUInt32LE(0)).toBe(0x04034b50); // local file header
  expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50); // end of central directory
  const body = zip.toString('latin1');
  for (const name of ['datacanvas-powerbi/dataset.csv', 'datacanvas-powerbi/transformations.pq', 'datacanvas-powerbi/data-dictionary.json', 'datacanvas-powerbi/README.md', 'datacanvas-powerbi/dashboard-spec.json']) {
    expect(body).toContain(name);
  }
});

test('downloads XLSX, JSON and the dashboard description without any network request', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('http://localhost:4173') && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
  });
  await upload(page, csv);

  const xlsx = await download(page, 'export-xlsx');
  expect(xlsx.name).toBe('sales-cleaned.xlsx');
  expect(xlsx.bytes.subarray(0, 2).toString('latin1')).toBe('PK');

  const json = await download(page, 'export-json');
  const parsed = JSON.parse(json.bytes.toString('utf8'));
  expect(parsed.rows).toHaveLength(3);
  expect(parsed.dictionary.columns.map((c: { type: string }) => c.type)).toEqual(['date', 'text', 'text', 'number']);

  const spec = await download(page, 'export-spec');
  expect(spec.name).toBe('sales.datacanvas.json');
  expect(JSON.parse(spec.bytes.toString('utf8'))).toMatchObject({ format: 'datacanvas-dashboard-spec' });
  expect(external).toEqual([]);
});
