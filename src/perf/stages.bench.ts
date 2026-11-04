import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recommend, resolveReadings } from '../dashboard/recommend';
import type { ChartSpec, Filter } from '../dashboard/types';
import { buildTidyTable } from '../export/tidy';
import { toCsv } from '../export/csv';
import { toXlsx } from '../export/xlsx';
import { suggestNormalizations } from '../normalize/suggest';
import { parseFile } from '../parse/parseFile';
import { inferColumns } from '../profile/inferColumns';
import { runSpecs } from '../worker/aggregate';
import { ColumnStore } from '../worker/columnStore';
import { generateCsv } from './generate';

const CASES = [
  { label: '10k x 10', rows: 10_000, columns: 10 },
  { label: '50k x 20', rows: 50_000, columns: 20 },
  { label: '100k x 20', rows: 100_000, columns: 20 },
  { label: '20k x 100 (wide)', rows: 20_000, columns: 100 },
] as const;

const ms = (n: number) => Math.round(n * 10) / 10;
function time<T>(fn: () => T): [T, number] {
  const t = performance.now();
  const out = fn();
  return [out, performance.now() - t];
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** Not part of `npm test`; run with `npm run bench`. Prints a table and enforces the plan's filter target. */
describe('pipeline stage timings (Node, single thread, no worker overhead)', () => {
  const results: Record<string, Record<string, number | string>> = {};

  for (const c of CASES) {
    it(c.label, () => {
      const csv = generateCsv({ rows: c.rows, columns: c.columns });
      const buffer = new TextEncoder().encode(csv).buffer as ArrayBuffer;

      const [table, tParse] = time(() => parseFile(buffer, 'bench.csv'));
      const [columns, tProfile] = time(() => inferColumns(table.headers, table.originalHeaders, table.rows));
      const [suggestions, tSuggest] = time(() => suggestNormalizations(columns, table.rows));
      const store = new ColumnStore(table, columns);
      const readings = resolveReadings(columns, { c0: { order: 'ymd', calendar: 'gregorian' } });
      store.setReading('c0', { order: 'ymd', calendar: 'gregorian' });
      const rec = recommend(columns, readings);
      const specs: ChartSpec[] = [...rec.kpis, ...rec.charts];

      // First aggregation pays for building typed columns; later ones are the steady state.
      const [, tFirst] = time(() => runSpecs(store, specs, []));

      // Filter latency: a different city each time so the result cache cannot help.
      const cityId = columns.find((col) => col.displayName === 'المدينة')!.id;
      const cities = [...store.categorical(cityId).labels].slice(0, 7);
      const filterTimes = cities.map((city) => {
        const filters: Filter[] = [{ columnId: cityId, values: [city] }];
        return time(() => runSpecs(store, specs, filters))[1];
      });
      const [, tCached] = time(() => runSpecs(store, specs, [{ columnId: cityId, values: [cities[0]!] }]));

      const [tidy, tTidy] = time(() => buildTidyTable(store));
      const [, tCsv] = time(() => toCsv(tidy));
      const [, tXlsx] = time(() => toXlsx(tidy, { sheet: 'Data', rtl: true }));

      results[c.label] = {
        'file MB': ms(buffer.byteLength / 1024 / 1024),
        'parse ms': ms(tParse),
        'profile ms': ms(tProfile),
        'merge-suggest ms': ms(tSuggest),
        'first aggregate ms': ms(tFirst),
        'filter median ms': ms(median(filterTimes)),
        'filter max ms': ms(Math.max(...filterTimes)),
        'cached ms': ms(tCached),
        'tidy ms': ms(tTidy),
        'csv ms': ms(tCsv),
        'xlsx ms': Number.isNaN(tXlsx) ? 'skipped' : ms(tXlsx),
        'charts+kpis': specs.length,
        suggestions: suggestions.length,
      };
      expect(table.rows.length).toBe(c.rows);
      if (c.label === '100k x 20') {
        // Plan target: filter -> chart update under ~300 ms at 100k x 20.
        expect(median(filterTimes)).toBeLessThan(300);
      }
    }, 120_000);
  }

  it('prints the summary', () => {
    console.table(results);
    // Vitest can swallow console output (CI, non-TTY), so also persist the numbers.
    writeFileSync('bench-results.json', JSON.stringify(results, null, 2));
  });
});
