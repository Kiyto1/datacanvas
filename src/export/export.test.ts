import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { RawCell, RawTable } from '../core/types';
import { inferColumns } from '../profile/inferColumns';
import { ColumnStore } from '../worker/columnStore';
import { neutralizeFormula, plainNumber, toCsv } from './csv';
import { buildDictionary, toJsonRows } from './dictionary';
import { buildPowerQuery, DATA_FOLDER_PLACEHOLDER, mText } from './powerQuery';
import { runExport, safeBaseName, type ExportRequest } from './run';
import { buildTidyTable, type TidyTable } from './tidy';
import { toXlsx } from './xlsx';
import { createZip, crc32 } from './zip';

function makeStore(headers: string[], rows: RawCell[][]): ColumnStore {
  const table: RawTable = { headers, originalHeaders: headers, rows, encoding: 'utf-8' };
  return new ColumnStore(table, inferColumns(headers, headers, rows));
}

const salesHeaders = ['التاريخ', 'المدينة', 'المبيعات'];
const salesRows: RawCell[][] = [
  ['2026/01/01', 'الرياض', '5,000'],
  ['2026/01/02', 'Riyadh', '-1,500'],
  ['2026/01/03', 'جدة', null],
];
const decode = (b: Uint8Array) => new TextDecoder().decode(b);

describe('neutralizeFormula / plainNumber', () => {
  it('neutralises formula-like TEXT but not plain numbers or ordinary text', () => {
    expect(neutralizeFormula('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(neutralizeFormula('@cmd')).toBe("'@cmd");
    expect(neutralizeFormula('-cmd|calc')).toBe("'-cmd|calc");
    expect(neutralizeFormula('+cmd')).toBe("'+cmd");
    expect(neutralizeFormula('-1500')).toBe('-1500');
    expect(neutralizeFormula('+966501234567')).toBe('+966501234567');
    expect(neutralizeFormula('الرياض')).toBe('الرياض');
    expect(neutralizeFormula('')).toBe('');
  });

  it('formats numbers with full precision, a dot and no grouping or exponent', () => {
    expect(plainNumber(1234567.891)).toBe('1234567.891');
    expect(plainNumber(-1500)).toBe('-1500');
    expect(plainNumber(1e21)).not.toMatch(/e/i);
    expect(plainNumber(0.0000001)).not.toMatch(/e/i);
  });
});

describe('buildTidyTable (export contract)', () => {
  const store = makeStore(salesHeaders, salesRows);
  store.setReading('c0', { order: 'ymd', calendar: 'gregorian' });
  const table = buildTidyTable(store);

  it('types columns and keeps negatives as numbers', () => {
    expect(table.columns.map((c) => c.type)).toEqual(['date', 'text', 'number']);
    expect(table.rows[1]?.[2]).toBe(-1500);
    expect(table.rows[2]?.[2]).toBeNull(); // missing stays null
    expect(table.rows[0]?.[0]).toEqual({ y: 2026, m: 1, d: 1 });
  });

  it('exports approved merges as display values and notes them, without touching originals', () => {
    store.setDecisions(new Map([['c1', new Map([['Riyadh', 'الرياض']])]]));
    const merged = buildTidyTable(store);
    expect(merged.rows.map((r) => r[1])).toEqual(['الرياض', 'الرياض', 'جدة']);
    expect(merged.columns[1]?.notes.join(' ')).toContain('merged: 1');
    expect(store.table.rows[1]?.[1]).toBe('Riyadh');
  });

  it('falls back to text (flagged) when a numeric column has unparsable values', () => {
    // 98% numeric: the profiler types it as a number, so the export must catch the 2 stragglers.
    const rows: RawCell[][] = Array.from({ length: 100 }, (_, i) => [i % 50 === 0 ? 'N/A' : String(100 + i)]);
    const s = makeStore(['المبيعات'], rows);
    expect(s.columns[0]?.type).toBe('number');
    const t = buildTidyTable(s);
    expect(t.columns[0]?.type).toBe('text');
    expect(t.columns[0]?.notes.join(' ')).toContain('type-fallback');
    expect(t.rows[0]?.[0]).toBe('N/A');
  });

  it('exports unconfirmed and Hijri dates as original text, never guessing or converting', () => {
    const ambiguous = makeStore(['d'], [['03/04/2026'], ['05/06/2026'], ['01/02/2026']]);
    const a = buildTidyTable(ambiguous);
    expect(a.columns[0]?.type).toBe('text');
    expect(a.columns[0]?.notes.join(' ')).toContain('date-unconfirmed');
    expect(a.rows[0]?.[0]).toBe('03/04/2026');

    const hijri = makeStore(['d'], [['1447/05/12'], ['1447/06/01']]);
    hijri.setReading('c0', { order: 'ymd', calendar: 'hijri' });
    const h = buildTidyTable(hijri);
    expect(h.columns[0]?.type).toBe('text');
    expect(h.columns[0]?.notes.join(' ')).toContain('hijri');
    expect(h.rows[0]?.[0]).toBe('1447/05/12');
  });

  it('parses yes/no columns to true/false', () => {
    const s = makeStore(['active'], [['نعم'], ['لا'], ['yes']]);
    const t = buildTidyTable(s);
    expect(t.columns[0]?.type).toBe('boolean');
    expect(t.rows.map((r) => r[0])).toEqual([true, false, true]);
  });
});

describe('toCsv', () => {
  const table: TidyTable = {
    columns: ['اسم', 'مبلغ', 'تاريخ', 'نشط'].map((name, i) => ({
      id: `c${i}`,
      name,
      originalName: name,
      type: 'text',
      role: 'unknown',
      nullable: true,
      nonNullCount: 1,
      distinctCount: 1,
      notes: [],
    })),
    rows: [
      ['=HYPERLINK("x")', -1500, { y: 2026, m: 1, d: 5 }, true],
      ['a,b "q"\nline', 3.5, null, false],
    ],
  };
  const bytes = toCsv(table);
  const text = decode(bytes.subarray(3));

  it('starts with a UTF-8 BOM and uses CRLF', () => {
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text.split('\r\n')[0]).toBe('اسم,مبلغ,تاريخ,نشط');
  });

  it('quotes per RFC 4180, neutralises formulas, keeps numbers typed and ISO dates', () => {
    expect(text).toContain(`'=HYPERLINK(""x"")`);
    expect(text).toContain(',-1500,2026-01-05,true');
    expect(text).toContain('"a,b ""q""\nline",3.5,,false');
  });
});

describe('toXlsx', () => {
  const table: TidyTable = {
    columns: ['نص', 'رقم', 'تاريخ', 'منطقي'].map((name, i) => ({
      id: `c${i}`,
      name,
      originalName: name,
      type: 'text',
      role: 'unknown',
      nullable: false,
      nonNullCount: 1,
      distinctCount: 1,
      notes: [],
    })),
    rows: [['=1+1', -1500, { y: 2026, m: 1, d: 15 }, true]],
  };

  it('writes typed cells; formula-looking text stays a string; dates are real dates; RTL is set', () => {
    const bytes = toXlsx(table, { sheet: 'البيانات', rtl: true });
    const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
    const ws = wb.Sheets['البيانات']!;
    expect(ws['A2']).toMatchObject({ t: 's', v: '=1+1' });
    expect(ws['A2']?.f).toBeUndefined();
    expect(ws['B2']).toMatchObject({ t: 'n', v: -1500 });
    expect(ws['C2']?.t).toBe('d');
    const d = ws['C2']!.v as Date;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 1, 15]);
    expect(ws['D2']).toMatchObject({ t: 'b', v: true });
    expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);
  });

  it('sanitises sheet names', () => {
    const wb = XLSX.read(toXlsx(table, { sheet: 'a/b:c*?[x]', rtl: false }), { type: 'array' });
    expect(wb.SheetNames[0]).not.toMatch(/[:\\/?*[\]]/);
  });
});

/** Minimal reader: proves the archive is structurally valid and the CRCs match. */
function readZip(zip: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = decode(zip.subarray(p + 46, p + 46 + nameLen));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    files[name] = data;
    p += 46 + nameLen;
  }
  return files;
}

describe('createZip', () => {
  it('round-trips files with Arabic names and valid CRCs', () => {
    const zip = createZip([
      { name: 'مجلد/ملف.txt', data: new TextEncoder().encode('مرحبا') },
      { name: 'b.bin', data: new Uint8Array([1, 2, 3, 255]) },
    ]);
    const files = readZip(zip);
    expect(Object.keys(files)).toEqual(['مجلد/ملف.txt', 'b.bin']);
    expect(decode(files['مجلد/ملف.txt']!)).toBe('مرحبا');
    expect([...files['b.bin']!]).toEqual([1, 2, 3, 255]);
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('Power Query script', () => {
  const store = makeStore(salesHeaders, salesRows);
  store.setReading('c0', { order: 'ymd', calendar: 'gregorian' });
  const pq = buildPowerQuery(buildTidyTable(store));

  it('has no machine-specific path and a clear DataFolder placeholder with a friendly error', () => {
    expect(pq).toContain(`DataFolder = "${DATA_FOLDER_PLACEHOLDER}"`);
    expect(pq).toContain('error "Set DataFolder');
    expect(pq).not.toMatch(/[A-Za-z]:\\(Users|Documents|Desktop)/);
  });

  it('sets Csv.Document options explicitly and types every column with en-US', () => {
    expect(pq).toContain('Encoding = 65001');
    expect(pq).toContain('Delimiter = ","');
    expect(pq).toContain('QuoteStyle = QuoteStyle.Csv');
    expect(pq).toContain('Columns = 3');
    expect(pq).toContain('{"التاريخ", type date}');
    expect(pq).toContain('{"المدينة", type text}');
    expect(pq).toContain('{"المبيعات", type number}');
    expect(pq).toContain('"en-US"');
    expect(pq).toContain('Replacer.ReplaceValue');
  });

  it('escapes quotes and # in M text literals', () => {
    expect(mText('a"b#c')).toBe('"a""b#(#)c"');
    expect(mText('x\ny')).toBe('"x#(lf)y"');
  });
});

describe('runExport', () => {
  const store = makeStore(salesHeaders, salesRows);
  store.setReading('c0', { order: 'ymd', calendar: 'gregorian' });
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const req = (kind: ExportRequest['kind']): ExportRequest => ({
    kind,
    fileName: 'مبيعات 2026.xlsx',
    lang: 'ar',
    dashboardSpecJson: '{"format":"datacanvas-dashboard-spec"}',
  });

  it('names files from the upload and builds each kind', () => {
    expect(runExport(store, req('csv'), now)).toMatchObject({ fileName: 'مبيعات 2026-cleaned.csv' });
    expect(runExport(store, req('xlsx'), now).fileName).toBe('مبيعات 2026-cleaned.xlsx');
    expect(runExport(store, req('spec'), now).fileName).toBe('مبيعات 2026.datacanvas.json');
    const json = JSON.parse(decode(runExport(store, req('json'), now).bytes));
    expect(json.rows[0]).toMatchObject({ المدينة: 'الرياض', المبيعات: 5000, التاريخ: '2026-01-01' });
    expect(json.dictionary.columns).toHaveLength(3);
  });

  it('builds the Power BI and Metabase packages with the promised files', () => {
    const pbi = readZip(runExport(store, req('powerbi'), now).bytes);
    expect(Object.keys(pbi).sort()).toEqual(
      [
        'datacanvas-powerbi/README.md',
        'datacanvas-powerbi/dashboard-spec.json',
        'datacanvas-powerbi/data-dictionary.json',
        'datacanvas-powerbi/dataset.csv',
        'datacanvas-powerbi/transformations.pq',
      ].sort(),
    );
    expect(decode(pbi['datacanvas-powerbi/README.md']!)).toContain('DataFolder');
    const mb = readZip(runExport(store, req('metabase'), now).bytes);
    expect(Object.keys(mb).sort()).toEqual(
      ['datacanvas-metabase/README.md', 'datacanvas-metabase/dashboard-spec.json', 'datacanvas-metabase/data-dictionary.json', 'datacanvas-metabase/dataset.csv'].sort(),
    );
    expect(decode(mb['datacanvas-metabase/README.md']!)).toMatch(/Uploads/);
    expect(decode(mb['datacanvas-metabase/dashboard-spec.json']!)).toContain('datacanvas-dashboard-spec');
  });

  it('puts the same cleaned values in the CSV and the dictionary row counts', () => {
    const pbi = readZip(runExport(store, req('powerbi'), now).bytes);
    const csv = decode(pbi['datacanvas-powerbi/dataset.csv']!.subarray(3));
    expect(csv.trim().split('\r\n')).toHaveLength(4); // header + 3 rows
    const dict = JSON.parse(decode(pbi['datacanvas-powerbi/data-dictionary.json']!));
    expect(dict.dataset.rowCount).toBe(3);
    expect(dict.conventions.decimalSeparator).toBe('.');
  });

  it('sanitises file names', () => {
    expect(safeBaseName('../a/b:c*?.csv')).toBe('.._a_b_c__');
    expect(safeBaseName('.csv')).not.toBe('');
    expect(safeBaseName('')).toBe('dataset');
  });
});

describe('dictionary and JSON rows', () => {
  it('records applied merges by column name', () => {
    const store = makeStore(['المدينة'], [['الرياض'], ['Riyadh']]);
    const table = buildTidyTable(store);
    const dict = buildDictionary(table, { name: 'x', exportedAt: 'now' }, [{ columnId: 'c0', from: 'Riyadh', to: 'الرياض', count: 1 }]);
    expect(dict.appliedMerges).toEqual([{ column: 'المدينة', from: 'Riyadh', to: 'الرياض', count: 1 }]);
    expect(toJsonRows(table)).toHaveLength(2);
  });
});
