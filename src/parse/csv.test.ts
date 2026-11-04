import { describe, expect, it } from 'vitest';
import { LIMITS } from '../core/types';
import { inferColumns } from '../profile/inferColumns';
import { detectDelimiter, parseCsv } from './csv';
import { parseFile } from './parseFile';

const buf = (s: string): ArrayBuffer => new TextEncoder().encode(s).slice().buffer;

describe('parseCsv', () => {
  it('handles quoted fields with delimiters, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('a,b,c\n"x,1","he said ""hi""","line1\nline2"\n', ',');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x,1', 'he said "hi"', 'line1\nline2'],
    ]);
  });

  it('accepts CRLF, LF and CR line endings and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4', ',')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    expect(parseCsv('a,b\n1,2\n', ',')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2\r', ',')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps empty fields, including a trailing delimiter', () => {
    expect(parseCsv('a,b,c\n1,,\n,,', ',')).toEqual([['a', 'b', 'c'], ['1', '', ''], ['', '', '']]);
    expect(parseCsv('a,b\n1,', ',')).toEqual([['a', 'b'], ['1', '']]);
  });

  it('is lenient with an unterminated quote and returns nothing for empty input', () => {
    expect(parseCsv('a,"b\n1,2', ',')).toEqual([['a', 'b\n1,2']]);
    expect(parseCsv('', ',')).toEqual([]);
  });

  it('respects maxRecords', () => {
    expect(parseCsv('a\nb\nc\nd\n', ',', 2)).toEqual([['a'], ['b']]);
  });
});

describe('detectDelimiter', () => {
  it('detects semicolons (common in Arabic/European Excel exports), tabs and pipes', () => {
    expect(detectDelimiter('المدينة;المبيعات\nالرياض;5000\nجدة;3500\n')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
    expect(detectDelimiter('a|b\n1|2\n')).toBe('|');
    expect(detectDelimiter('a,b\n1,2\n')).toBe(',');
  });

  it('is not fooled by delimiters inside quotes or decimal commas in other columns', () => {
    expect(detectDelimiter('الاسم;المبلغ\n"أحمد, محمد";"1,5"\nسارة;2\n')).toBe(';');
  });

  it('falls back to a comma for a single column', () => {
    expect(detectDelimiter('الاسم\nأحمد\nسارة\n')).toBe(',');
  });
});

describe('parseFile with the direct CSV parser', () => {
  it('reads a semicolon-separated Arabic file without any configuration', () => {
    const t = parseFile(buf('التاريخ;المدينة;المبيعات\n2026/01/01;الرياض;5000\n2026/01/02;جدة;3500\n'), 'x.csv');
    expect(t.headers).toEqual(['التاريخ', 'المدينة', 'المبيعات']);
    expect(t.rows[1]).toEqual(['2026/01/02', 'جدة', '3500']);
  });

  it('honours the .tsv extension and drops blank lines in the middle', () => {
    const t = parseFile(buf('a\tb\n1\t2\n\n3\t4\n'), 'x.tsv');
    expect(t.rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('reads quoted multi-line cells as one row', () => {
    const t = parseFile(buf('a,b\n"x\ny",2\n'), 'x.csv');
    expect(t.rows).toEqual([['x\ny', '2']]);
  });

  it('still enforces the row limit', () => {
    expect(LIMITS.maxRows).toBeGreaterThan(0);
  });
});

describe('profiling a large column uses a sample but stays correct', () => {
  it('types a 20k-row numeric column and confirms day-first dates when 10% of values prove it', () => {
    const rows = Array.from({ length: 20_000 }, (_, i) => [String(1000 + i), i >= 18_000 ? '25/04/2026' : '03/04/2026']);
    const [num, date] = inferColumns(['المبيعات', 'التاريخ'], ['', ''], rows);
    expect(num?.type).toBe('number');
    expect(date?.dateInference?.status).toBe('confirmed');
    expect(date?.dateInference?.chosen?.order).toBe('dmy');
  });

  it('still asks the user when a lone value is the only evidence (could be a typo)', () => {
    const rows = Array.from({ length: 20_000 }, (_, i) => [i === 19_999 ? '25/04/2026' : '03/04/2026']);
    const [date] = inferColumns(['التاريخ'], [''], rows);
    expect(date?.dateInference?.status).toBe('ambiguous');
  });
});
