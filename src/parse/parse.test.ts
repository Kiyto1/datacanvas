import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { LIMITS, ParseError } from '../core/types';
import { decodeText } from './decode';
import { parseFile } from './parseFile';

const enc = (s: string) => new TextEncoder().encode(s);
const buf = (s: string): ArrayBuffer => enc(s).slice().buffer;

describe('decodeText', () => {
  it('decodes UTF-8 and strips the BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('الرياض')]);
    expect(decodeText(bytes)).toEqual({ text: 'الرياض', encoding: 'utf-8' });
  });

  it('falls back to Windows-1256 for non-UTF-8 Arabic bytes', () => {
    // الرياض in Windows-1256
    const bytes = new Uint8Array([0xc7, 0xe1, 0xd1, 0xed, 0xc7, 0xd6]);
    expect(decodeText(bytes)).toEqual({ text: 'الرياض', encoding: 'windows-1256' });
  });
});

describe('parseFile (CSV)', () => {
  const csv = 'التاريخ,المدينة,المنتج,المبيعات\n2026/01/01,الرياض,حاسب محمول,"5,000"\n2026/01/02,جدة,هاتف,"3,500"\n';

  it('parses Arabic headers and keeps every value as the original text', () => {
    const t = parseFile(buf(csv), 'sales.csv');
    expect(t.headers).toEqual(['التاريخ', 'المدينة', 'المنتج', 'المبيعات']);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toEqual(['2026/01/01', 'الرياض', 'حاسب محمول', '5,000']);
    expect(t.encoding).toBe('utf-8');
  });

  it('turns empty cells into null and pads short rows', () => {
    const t = parseFile(buf('a,b,c\n1,,3\n4\n'), 'x.csv');
    expect(t.rows).toEqual([
      ['1', null, '3'],
      ['4', null, null],
    ]);
  });

  it('sanitizes duplicate/empty headers but preserves originals', () => {
    const t = parseFile(buf('x,x,\n1,2,3\n'), 'x.csv');
    expect(t.headers).toEqual(['x', 'x_2', 'column_3']);
    expect(t.originalHeaders).toEqual(['x', 'x', '']);
  });

  it('never reinterprets leading zeros or Arabic-Indic digits', () => {
    const t = parseFile(buf('id,n\n007,٣٥٠٠\n'), 'x.csv');
    expect(t.rows[0]).toEqual(['007', '٣٥٠٠']);
  });
});

describe('parseFile (XLSX)', () => {
  it('reads the first sheet with typed numbers', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['المدينة', 'المبيعات'],
      ['الرياض', 5000],
      ['جدة', 3500],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ورقة1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const t = parseFile(out, 'sales.xlsx');
    expect(t.headers).toEqual(['المدينة', 'المبيعات']);
    expect(t.rows).toEqual([
      ['الرياض', 5000],
      ['جدة', 3500],
    ]);
    expect(t.sheetName).toBe('ورقة1');
  });
});

describe('parseFile errors', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof ParseError ? e.code : 'other';
    }
    return 'none';
  };

  it('rejects unsupported types, empty files and oversized files', () => {
    expect(code(() => parseFile(buf('x'), 'a.pdf'))).toBe('unsupported-type');
    expect(code(() => parseFile(new ArrayBuffer(0), 'a.csv'))).toBe('empty');
    expect(code(() => parseFile(buf('\n\n'), 'a.csv'))).toBe('empty');
    expect(code(() => parseFile(new ArrayBuffer(LIMITS.maxFileBytes + 1), 'a.csv'))).toBe('file-too-large');
  });

  it('rejects too many columns', () => {
    const header = Array.from({ length: LIMITS.maxColumns + 1 }, (_, i) => `c${i}`).join(',');
    expect(code(() => parseFile(buf(`${header}\n`), 'a.csv'))).toBe('too-many-columns');
  });
});
