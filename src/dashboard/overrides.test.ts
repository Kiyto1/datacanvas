import { describe, expect, it } from 'vitest';
import type { RawCell } from '../core/types';
import { inferColumns } from '../profile/inferColumns';
import { allowedAggregations, applyOverride, dimensionChoices, measureChoices } from './overrides';
import type { ChartSpec } from './types';

const headers = ['رقم الموظف', 'سعر الوحدة', 'النوع', 'المدينة', 'الكمية'];
const rows: RawCell[][] = Array.from({ length: 40 }, (_, i) => [1000 + i, 10 + (i % 7), `x${i % 3}`, `c${i % 4}`, i + 1]);
const columns = inferColumns(headers, headers, rows);
const id = (name: string) => columns.find((c) => c.displayName === name)!.id;

const bar: ChartSpec = { id: 'bar:a', kind: 'bar', dimension: id('النوع'), measure: id('الكمية'), agg: 'sum', topN: 10 };

describe('chart overrides', () => {
  it('only offers valid choices: no identifiers as measures, no sum for unit prices', () => {
    expect(measureChoices(columns).map((c) => c.displayName)).toEqual(expect.not.arrayContaining(['رقم الموظف']));
    expect(measureChoices(columns).map((c) => c.displayName)).toEqual(expect.arrayContaining(['سعر الوحدة', 'الكمية']));
    expect(allowedAggregations(columns, id('سعر الوحدة'))).not.toContain('sum');
    expect(allowedAggregations(columns, id('الكمية'))).toContain('sum');
    expect(allowedAggregations(columns, null)).toEqual(['count']);
    expect(dimensionChoices(columns).map((c) => c.displayName)).toEqual(expect.arrayContaining(['النوع', 'المدينة']));
  });

  it('returns the recommendation untouched without an override', () => {
    expect(applyOverride(bar, undefined, columns)).toBe(bar);
  });

  it('changes the grouping and size but keeps the rest', () => {
    const out = applyOverride(bar, { dimension: id('المدينة'), topN: 5 }, columns);
    expect(out).toMatchObject({ kind: 'bar', dimension: id('المدينة'), measure: id('الكمية'), agg: 'sum', topN: 5 });
  });

  it('resets the calculation to an allowed one when the measure changes', () => {
    const out = applyOverride(bar, { measure: id('سعر الوحدة') }, columns);
    expect(out).toMatchObject({ measure: id('سعر الوحدة'), agg: 'avg' }); // never sum for a unit price
  });

  it('refuses a calculation that is not allowed for the measure', () => {
    const out = applyOverride(bar, { measure: id('سعر الوحدة'), agg: 'sum' }, columns);
    expect(out).toMatchObject({ agg: 'avg' });
  });

  it('counting records clears the measure and forces count', () => {
    const out = applyOverride(bar, { measure: null }, columns);
    expect(out).toMatchObject({ measure: null, agg: 'count' });
  });

  it('accepts a valid calculation change on the same measure', () => {
    expect(applyOverride(bar, { agg: 'avg' }, columns)).toMatchObject({ agg: 'avg' });
  });

  it('applies to lines and distributions and ignores kinds that have no editor', () => {
    const line: ChartSpec = { id: 'line:a', kind: 'line', date: 'c0', measure: id('الكمية'), agg: 'sum' };
    expect(applyOverride(line, { measure: id('سعر الوحدة') }, columns)).toMatchObject({ measure: id('سعر الوحدة'), agg: 'avg' });
    const dist: ChartSpec = { id: 'dist:a', kind: 'distribution', dimension: id('النوع') };
    expect(applyOverride(dist, { dimension: id('المدينة') }, columns)).toMatchObject({ dimension: id('المدينة') });
    const scatter: ChartSpec = { id: 's', kind: 'scatter', x: 'c1', y: 'c4' };
    expect(applyOverride(scatter, { dimension: 'c3' }, columns)).toBe(scatter);
  });
});
