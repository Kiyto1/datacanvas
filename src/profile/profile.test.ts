import { describe, expect, it } from 'vitest';
import { comparisonKey, toWesternDigits } from '../core/arabic';
import type { RawCell } from '../core/types';
import { inferDateColumn, parseDateWith } from './dates';
import { hintForHeader } from './dictionary';
import { inferColumns } from './inferColumns';
import { parseNumber } from './numbers';

describe('arabic helpers', () => {
  it('converts Arabic-Indic and Persian digits and separators', () => {
    expect(toWesternDigits('٣٥٠٠')).toBe('3500');
    expect(toWesternDigits('۱۲۳')).toBe('123');
    expect(toWesternDigits('١٢٬٣٤٥٫٦')).toBe('12,345.6');
  });

  it('builds comparison keys: strips tashkeel/tatweel, folds alef and yaa, keeps taa marbuta', () => {
    expect(comparisonKey('الرّياض')).toBe(comparisonKey('الرياض'));
    expect(comparisonKey('أحمد')).toBe(comparisonKey('احمد'));
    expect(comparisonKey('مصـــر')).toBe('مصر');
    expect(comparisonKey('على')).toBe(comparisonKey('علي'));
    expect(comparisonKey('مدينة')).not.toBe(comparisonKey('مدينه'));
  });
});

describe('parseNumber', () => {
  it('parses grouped, Arabic and negative numbers', () => {
    expect(parseNumber('5,000')).toBe(5000);
    expect(parseNumber('٣٬٥٠٠')).toBe(3500);
    expect(parseNumber('-1,500')).toBe(-1500);
    expect(parseNumber('3.5')).toBe(3.5);
    expect(parseNumber('1 234 567')).toBe(1234567);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber(42)).toBe(42);
  });

  it('rejects identifiers, ambiguous text and non-numbers', () => {
    expect(parseNumber('007')).toBeNull();
    expect(parseNumber('1234567890123456')).toBeNull();
    expect(parseNumber('12abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber(Number.NaN)).toBeNull();
  });
});

describe('date inference', () => {
  it('confirms yyyy/mm/dd including Arabic digits', () => {
    const r = inferDateColumn(['2026/01/01', '٢٠٢٦/٠١/٠٢', '2026-01-03']);
    expect(r?.status).toBe('confirmed');
    expect(r?.chosen).toEqual({ order: 'ymd', calendar: 'gregorian' });
  });

  it('flags 03/04/2026 as ambiguous when no value disambiguates', () => {
    const r = inferDateColumn(['03/04/2026', '05/06/2026', '01/02/2026']);
    expect(r?.status).toBe('ambiguous');
    expect(r?.chosen).toBeNull();
    expect(r?.candidates.map((c) => c.order)).toEqual(['dmy', 'mdy']);
  });

  it('resolves dd/mm when a day exceeds 12 and mm/dd when a second part does', () => {
    expect(inferDateColumn(['25/04/2026', '03/04/2026'])?.chosen?.order).toBe('dmy');
    expect(inferDateColumn(['04/25/2026', '03/04/2026'])?.chosen?.order).toBe('mdy');
  });

  it('asks for confirmation on Hijri-looking years and rejects non-dates', () => {
    expect(inferDateColumn(['1447/05/12', '1447/06/01'])?.status).toBe('needs-confirmation');
    expect(inferDateColumn(['الرياض', 'جدة'])).toBeNull();
    expect(inferDateColumn(['2026/13/40'])).toBeNull();
  });

  it('parses a value under a chosen reading', () => {
    expect(parseDateWith('03/04/2026', { order: 'dmy', calendar: 'gregorian' })).toEqual({ y: 2026, m: 4, d: 3 });
    expect(parseDateWith('03/04/2026', { order: 'mdy', calendar: 'gregorian' })).toEqual({ y: 2026, m: 3, d: 4 });
    expect(parseDateWith('2026/02/30', { order: 'ymd', calendar: 'gregorian' })).toBeNull();
  });
});

describe('header dictionary', () => {
  it('recognises Arabic and English business terms', () => {
    expect(hintForHeader('التاريخ')).toBe('date');
    expect(hintForHeader('المدينة')).toBe('dimension');
    expect(hintForHeader('المبيعات')).toBe('measure');
    expect(hintForHeader('سعر الوحدة')).toBe('unit-price');
    expect(hintForHeader('الرقم الوظيفي')).toBe('identifier');
    expect(hintForHeader('customer_id')).toBe('identifier');
    expect(hintForHeader('xyz')).toBeNull();
  });
});

describe('inferColumns', () => {
  const headers = ['التاريخ', 'المدينة', 'المنتج', 'المبيعات'];
  const rows: RawCell[][] = [
    ['2026/01/01', 'الرياض', 'حاسب محمول', '5,000'],
    ['2026/01/02', 'جدة', 'هاتف', '3,500'],
    ['2026/01/03', 'المدينة المنورة', 'حاسب محمول', '4,200'],
  ];
  const cols = inferColumns(headers, headers, rows);

  it('detects the sales table from the brief', () => {
    expect(cols.map((c) => [c.type, c.role])).toEqual([
      ['date', 'dimension'],
      ['string', 'dimension'],
      ['string', 'dimension'],
      ['number', 'measure'],
    ]);
    expect(cols[3]?.defaultAggregation).toBe('sum');
  });

  it('never allows summing identifiers; unit prices default to average', () => {
    const idRows: RawCell[][] = Array.from({ length: 12 }, (_, i) => [1000 + i, 10 + i, `x${i % 2}`]);
    const [id, price] = inferColumns(['رقم الموظف', 'سعر الوحدة', 'النوع'], ['', '', ''], idRows);
    expect(id?.role).toBe('identifier');
    expect(id?.allowedAggregations).not.toContain('sum');
    expect(price?.unitPrice).toBe(true);
    expect(price?.allowedAggregations).not.toContain('sum');
    expect(price?.defaultAggregation).toBe('avg');
  });

  it('treats a unique integer column as an identifier by data even without a header hint', () => {
    const r: RawCell[][] = Array.from({ length: 15 }, (_, i) => [i + 1, i * 3]);
    const [a] = inferColumns(['a', 'b'], ['a', 'b'], r);
    expect(a?.role).toBe('identifier');
    expect(a?.roleSource).toBe('data');
  });

  it('records nulls and ambiguous dates', () => {
    const [d, n] = inferColumns(['d', 'n'], ['d', 'n'], [
      ['03/04/2026', null],
      ['05/06/2026', 1],
    ]);
    expect(d?.dateInference?.status).toBe('ambiguous');
    expect(n?.nullable).toBe(true);
    expect(n?.nullRate).toBe(0.5);
  });
});
