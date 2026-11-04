import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { generateCsv } from '../src/perf/generate';

// Run with `npm run bench:browser`. Measures the real worker + UI against the production build.
const CASES = [
  { label: '50k x 20', rows: 50_000, columns: 20 },
  { label: '100k x 20', rows: 100_000, columns: 20 },
  { label: '20k x 100 (wide)', rows: 20_000, columns: 100 },
] as const;

const results: Record<string, Record<string, number>> = {};

for (const c of CASES) {
  test(`browser timings ${c.label}`, async ({ page }) => {
    test.setTimeout(180_000);
    const csv = Buffer.from(generateCsv({ rows: c.rows, columns: c.columns }), 'utf8');
    await page.goto('/');

    // Load: file chosen -> dashboard numbers on screen (parse + profile + first aggregation + render).
    const t0 = Date.now();
    await page.getByTestId('file-input').setInputFiles({ name: 'bench.csv', mimeType: 'text/csv', buffer: csv });
    await expect(page.getByTestId('kpi-kpi:records')).toHaveText(new RegExp(`${String(c.rows).slice(0, -3)}[,٬]000`), { timeout: 120_000 });
    await expect(page.locator('canvas').first()).toBeVisible();
    const loadMs = Date.now() - t0;

    // Filter: click a category in the table view -> KPI updates (worker round trip + render).
    // Use whichever bar chart the recommender ranked first; its table rows are the filter buttons.
    const toggle = page.locator('[data-testid^="table-toggle-bar:"]').first();
    const specId = (await toggle.getAttribute('data-testid'))!.replace('table-toggle-', '');
    await toggle.click();
    const filterTimes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const target = page.locator(`[data-testid^="filter-${specId}-"]`).nth(i);
      const before = await page.getByTestId('kpi-kpi:records').innerText();
      const t = Date.now();
      await target.click();
      await expect(page.getByTestId('kpi-kpi:records')).not.toHaveText(before);
      filterTimes.push(Date.now() - t);
      await page.getByTestId('clear-filters').click();
      await expect(page.getByTestId('kpi-kpi:records')).toHaveText(before);
    }
    filterTimes.sort((a, b) => a - b);

    // Export CSV (worker builds the file, browser downloads it).
    const t1 = Date.now();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
    await dl.path();
    const csvExportMs = Date.now() - t1;

    results[c.label] = { 'load ms': loadMs, 'filter median ms': filterTimes[Math.floor(filterTimes.length / 2)]!, 'filter max ms': filterTimes[filterTimes.length - 1]!, 'csv export ms': csvExportMs };
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/browser-bench.json', JSON.stringify(results, null, 2));

    // Plan target was ~300 ms for filter -> chart update; allow headroom for click + polling overhead.
    expect(filterTimes[Math.floor(filterTimes.length / 2)]!).toBeLessThan(1000);
    expect(loadMs).toBeLessThan(15_000);
  });
}
