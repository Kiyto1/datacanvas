import { describe, expect, it } from 'vitest';
import { recommend, resolveReadings } from '../dashboard/recommend';
import { suggestNormalizations } from '../normalize/suggest';
import { parseFile } from '../parse/parseFile';
import { inferColumns } from '../profile/inferColumns';
import { demoCsv } from './sales';

const buffer = () => new TextEncoder().encode(demoCsv()).buffer as ArrayBuffer;

describe('sample data', () => {
  const table = parseFile(buffer(), 'sample.csv');
  const columns = inferColumns(table.headers, table.originalHeaders, table.rows);

  it('is deterministic', () => {
    expect(demoCsv()).toBe(demoCsv());
  });

  it('has the realistic mess the product is built for: city names spelled several ways', () => {
    const suggestions = suggestNormalizations(columns, table.rows);
    expect(suggestions.length).toBeGreaterThan(0);
    const city = columns.find((c) => c.displayName === 'المدينة')!;
    const forCity = suggestions.filter((s) => s.columnId === city.id);
    const values = forCity.flatMap((s) => s.variants.map((v) => v.value));
    expect(values).toEqual(expect.arrayContaining(['الرياض', 'Riyadh', 'الرّياض']));
    expect(forCity.some((s) => s.suggestedDisplay === 'الرياض')).toBe(true);
  });

  it('is profiled as a clean sales table and yields a full dashboard', () => {
    const [date, , , sales] = columns;
    expect(date?.type).toBe('date');
    expect(date?.dateInference?.status).toBe('confirmed'); // yyyy/mm/dd is unambiguous
    expect(sales?.type).toBe('number');
    const rec = recommend(columns, resolveReadings(columns, {}));
    expect(rec.charts.some((c) => c.kind === 'line')).toBe(true);
    expect(rec.charts.filter((c) => c.kind === 'bar').length).toBeGreaterThanOrEqual(2);
    expect(table.rows.length).toBe(120);
  });
});
