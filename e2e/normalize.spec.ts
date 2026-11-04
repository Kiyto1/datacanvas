import { expect, test } from '@playwright/test';

const csv = 'المدينة,المبيعات\nالرياض,"5,000"\nRiyadh,"3,000"\nالرّياض,"2,000"\nجدة,"4,000"\nJeddah,"2,500"\n';

test('suggests merges, changes nothing until confirmed, and is reversible', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({ name: 'cities.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });

  await page.getByTestId('tab-data').click(); // the original values are visible in the data table
  await expect(page.getByTestId('normalization')).toBeVisible();
  await expect(page.getByTestId('suggestion-0')).toBeVisible();
  await expect(page.getByTestId('suggestion-1')).toBeVisible();

  // Nothing is pre-selected and nothing has changed yet.
  await expect(page.getByTestId('suggestion-check-0')).not.toBeChecked();
  await expect(page.getByRole('cell', { name: 'Riyadh', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Jeddah', exact: true })).toBeVisible();

  // Confirm both merges.
  await page.getByTestId('suggestion-check-0').check();
  await page.getByTestId('suggestion-check-1').check();
  await page.getByTestId('normalize-apply').click();

  await expect(page.getByTestId('normalize-status')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Riyadh', exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Jeddah', exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'الرياض', exact: true })).toHaveCount(3);
  await expect(page.getByRole('cell', { name: 'جدة', exact: true })).toHaveCount(2);

  // Undo restores the original values exactly.
  await page.getByTestId('normalize-undo').click();
  await expect(page.getByRole('cell', { name: 'Riyadh', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'الرّياض', exact: true })).toBeVisible();
  await expect(page.getByTestId('normalize-status')).toHaveCount(0);
});
