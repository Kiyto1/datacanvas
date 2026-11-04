import { describe, expect, it } from 'vitest';
import { dateParts, formatDateParts } from '../core/dateParts';
import type { RawCell, RawTable } from '../core/types';
import { inferColumns } from '../profile/inferColumns';
import { runSpecs } from '../worker/aggregate';
import { ColumnStore } from '../worker/columnStore';
import { recommend, resolveReadings } from './recommend';
import type { ChartSpec, Filter } from './types';

function makeStore(headers: string[], rows: RawCell[][]): ColumnStore {
  const table: RawTable = { headers, originalHeaders: headers, rows, encoding: 'utf-8' };
  return new ColumnStore(table, inferColumns(headers, headers, rows));
}

const salesHeaders = ['التاريخ', 'المدينة', 'المنتج', 'المبيعات'];
const salesRows: RawCell[][] = [
  ['2026/01/01', 'الرياض', 'حاسب محمول', '5,000'],
  ['2026/01/02', 'جدة', 'هاتف', '3,500'],
  ['2026/01/03', 'المدينة المنورة', 'حاسب محمول', '4,200'],
  ['2026/02/04', 'الرياض', 'هاتف', '1,000'],
  ['2026/02/05', 'جدة', 'حاسب محمول', '2,300'],
];

describe('recommend', () => {
  const store = makeStore(salesHeaders, salesRows);
  const readings = resolveReadings(store.columns, {});
  const rec = recommend(store.columns, readings);

  it('suggests the brief\'s analyses for the sales table', () => {
    expect(rec.kpis.map((k) => k.id)).toEqual(['kpi:records', 'kpi:c3:sum']);
    const kinds = rec.charts.map((c) => c.kind);
    expect(kinds[0]).toBe('line'); // trend first
    expect(rec.charts.some((c) => c.kind === 'bar' && c.dimension === 'c1')).toBe(true); // sales by city
    expect(rec.charts.some((c) => c.kind === 'bar' && c.dimension === 'c2')).toBe(true); // by product
  });

  it('skips date charts until an ambiguous date is resolved', () => {
    const rows: RawCell[][] = [['03/04/2026', 'a', 1], ['05/06/2026', 'b', 2], ['01/02/2026', 'a', 3]];
    const s = makeStore(['التاريخ', 'المدينة', 'المبيعات'], rows);
    expect(recommend(s.columns, resolveReadings(s.columns, {})).charts.some((c) => c.kind === 'line')).toBe(false);
    const chosen = resolveReadings(s.columns, { c0: { order: 'dmy', calendar: 'gregorian' } });
    expect(recommend(s.columns, chosen).charts.some((c) => c.kind === 'line')).toBe(true);
  });

  it('never sums identifiers or unit prices and caps the number of charts', () => {
    const rows: RawCell[][] = Array.from({ length: 30 }, (_, i) => [1000 + i, 10 + (i % 7), `x${i % 3}`, i]);
    const s = makeStore(['رقم الموظف', 'سعر الوحدة', 'النوع', 'الكمية'], rows);
    const r = recommend(s.columns, {});
    const specs = [...r.kpis, ...r.charts];
    for (const spec of specs) {
      if ('measure' in spec && spec.measure === 'c0') throw new Error('identifier used as a measure');
      if ('measure' in spec && spec.measure === 'c1') expect(spec.agg).toBe('avg');
    }
    expect(r.charts.length).toBeLessThanOrEqual(8);
  });
});

describe('runSpecs', () => {
  const store = makeStore(salesHeaders, salesRows);
  store.setReading('c0', { order: 'ymd', calendar: 'gregorian' });
  const run = (spec: ChartSpec, filters: Filter[] = []) => runSpecs(store, [spec], filters)[0]!;

  it('computes KPIs', () => {
    expect(run({ id: 'a', kind: 'kpi', measure: null, agg: 'count' })).toMatchObject({ value: 5 });
    expect(run({ id: 'b', kind: 'kpi', measure: 'c3', agg: 'sum' })).toMatchObject({ value: 16000 });
    expect(run({ id: 'c', kind: 'kpi', measure: 'c3', agg: 'avg' })).toMatchObject({ value: 3200 });
    expect(run({ id: 'd', kind: 'kpi', measure: 'c1', agg: 'distinctCount' })).toMatchObject({ value: 3 });
  });

  it('groups a bar by city, sorted by value', () => {
    const r = run({ id: 'e', kind: 'bar', dimension: 'c1', measure: 'c3', agg: 'sum', topN: 10 });
    expect(r).toMatchObject({
      labels: ['الرياض', 'جدة', 'المدينة المنورة'],
      values: [6000, 5800, 4200],
      omitted: 0,
    });
  });

  it('limits to topN and reports omitted categories', () => {
    const r = run({ id: 'f', kind: 'bar', dimension: 'c1', measure: 'c3', agg: 'sum', topN: 2 });
    expect(r).toMatchObject({ labels: ['الرياض', 'جدة'], omitted: 1 });
  });

  it('uses daily points for spans up to ~2 months, in time order', () => {
    const r = run({ id: 'g', kind: 'line', date: 'c0', measure: 'c3', agg: 'sum' });
    expect(r).toMatchObject({ granularity: 'day', values: [5000, 3500, 4200, 1000, 2300] });
    expect((r as { labels: string[] }).labels[0]).toBe('2026-01-01');
  });

  it('switches to monthly then yearly points as the span grows', () => {
    const monthly = makeStore(['التاريخ', 'المبيعات'], [['2026/01/10', 1], ['2026/01/20', 2], ['2026/04/05', 4]]);
    const m = runSpecs(monthly, [{ id: 'm', kind: 'line', date: 'c0', measure: 'c1', agg: 'sum' }], [])[0];
    expect(m).toMatchObject({ granularity: 'month', labels: ['2026-01', '2026-04'], values: [3, 4] });
    const yearly = makeStore(['التاريخ', 'المبيعات'], [['2020/01/10', 1], ['2024/06/20', 2]]);
    const y = runSpecs(yearly, [{ id: 'y', kind: 'line', date: 'c0', measure: 'c1', agg: 'sum' }], [])[0];
    expect(y).toMatchObject({ granularity: 'year', labels: ['2020', '2024'], values: [1, 2] });
  });

  it('cross-filters other charts but a bar keeps all its own categories', () => {
    const filters: Filter[] = [{ columnId: 'c1', values: ['الرياض'] }];
    expect(run({ id: 'h', kind: 'kpi', measure: 'c3', agg: 'sum' }, filters)).toMatchObject({ value: 6000 });
    const bar = run({ id: 'i', kind: 'bar', dimension: 'c1', measure: 'c3', agg: 'sum', topN: 10 }, filters);
    expect(bar).toMatchObject({ labels: ['الرياض', 'جدة', 'المدينة المنورة'] });
    const byProduct = run({ id: 'j', kind: 'bar', dimension: 'c2', measure: 'c3', agg: 'sum', topN: 10 }, filters);
    expect(byProduct).toMatchObject({ labels: ['حاسب محمول', 'هاتف'], values: [5000, 1000] });
  });

  it('returns distribution slices with an "other" remainder', () => {
    const r = run({ id: 'k', kind: 'distribution', dimension: 'c2' });
    expect(r).toMatchObject({ labels: ['حاسب محمول', 'هاتف'], values: [3, 2], other: 0 });
  });

  it('reads approved merges instead of the original spellings', () => {
    const s = makeStore(['المدينة', 'المبيعات'], [['الرياض', 100], ['Riyadh', 50], ['جدة', 30]]);
    s.setDecisions(new Map([['c0', new Map([['Riyadh', 'الرياض']])]]));
    const r = runSpecs(s, [{ id: 'm', kind: 'bar', dimension: 'c0', measure: 'c1', agg: 'sum', topN: 10 }], [])[0];
    expect(r).toMatchObject({ labels: ['الرياض', 'جدة'], values: [150, 30] });
    // original rows untouched
    expect(s.table.rows[1]?.[0]).toBe('Riyadh');
  });

  it('does not reuse cached results across datasets', () => {
    const a = makeStore(['k', 'v'], [['x', 1], ['y', 2]]);
    const b = makeStore(['k', 'v'], [['x', 10], ['y', 20]]);
    const spec: ChartSpec = { id: 'same', kind: 'kpi', measure: 'c1', agg: 'sum' };
    expect(runSpecs(a, [spec], [])[0]).toMatchObject({ value: 3 });
    expect(runSpecs(b, [spec], [])[0]).toMatchObject({ value: 30 });
  });
});

describe('spreadsheet dates', () => {
  it('uses local calendar parts so the day never shifts for users east of UTC', () => {
    const d = new Date(2026, 0, 15); // wall-clock Jan 15
    expect(formatDateParts(dateParts(d))).toBe('2026-01-15');
  });

  it('packs Date cells into the line chart', () => {
    const s = makeStore(['التاريخ', 'المبيعات'], [[new Date(2026, 0, 15), 10], [new Date(2026, 0, 16), 20]]);
    const r = runSpecs(s, [{ id: 'l', kind: 'line', date: 'c0', measure: 'c1', agg: 'sum' }], [])[0];
    expect(r).toMatchObject({ labels: ['2026-01-15', '2026-01-16'], values: [10, 20], granularity: 'day' });
  });
});
