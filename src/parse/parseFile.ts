import * as XLSX from 'xlsx';
import { sanitizeHeaders } from '../core/headers';
import { LIMITS, ParseError, type RawCell, type RawTable } from '../core/types';
import { decodeText } from './decode';

type FileKind = 'csv' | 'xlsx';

function detectKind(name: string): FileKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls')) return 'xlsx';
  throw new ParseError('unsupported-type', `Unsupported file type: ${name}`);
}

function toCell(value: unknown): RawCell {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'boolean' || value instanceof Date) return value;
  return String(value);
}

function finish(matrix: unknown[][], encoding: string, sheetName?: string): RawTable {
  // Drop fully empty trailing/leading rows so the header row is the first real row.
  const rows = matrix.map((r) => r.map(toCell));
  while (rows.length > 0 && rows[rows.length - 1]!.every((c) => c === null)) rows.pop();
  while (rows.length > 0 && rows[0]!.every((c) => c === null)) rows.shift();
  if (rows.length === 0) throw new ParseError('empty', 'The file has no data.');

  const headerRow = rows[0]!;
  const dataRows = rows.slice(1);
  if (headerRow.length > LIMITS.maxColumns) {
    throw new ParseError('too-many-columns', `More than ${LIMITS.maxColumns} columns.`);
  }
  if (dataRows.length > LIMITS.maxRows) {
    throw new ParseError('too-many-rows', `More than ${LIMITS.maxRows} rows.`);
  }

  const width = headerRow.length;
  const normalized = dataRows.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push(null);
    return out;
  });
  const originalHeaders = headerRow.map((c) => (c === null ? '' : String(c)));
  return {
    headers: sanitizeHeaders(originalHeaders),
    originalHeaders,
    rows: normalized,
    encoding,
    ...(sheetName !== undefined ? { sheetName } : {}),
  };
}

/** Parses CSV/TSV/XLSX bytes into an untouched RawTable. Never throws anything but ParseError. */
export function parseFile(buffer: ArrayBuffer, fileName: string): RawTable {
  if (buffer.byteLength > LIMITS.maxFileBytes) {
    throw new ParseError('file-too-large', `File exceeds ${LIMITS.maxFileBytes / 1024 / 1024} MB.`);
  }
  if (buffer.byteLength === 0) throw new ParseError('empty', 'The file is empty.');
  const kind = detectKind(fileName);

  try {
    if (kind === 'csv') {
      const { text, encoding } = decodeText(new Uint8Array(buffer));
      // type:'string' keeps SheetJS from guessing; we profile values ourselves.
      const wb = XLSX.read(text, { type: 'string', raw: true, FS: fileName.toLowerCase().endsWith('.tsv') ? '\t' : undefined });
      const name = wb.SheetNames[0];
      const sheet = name ? wb.Sheets[name] : undefined;
      if (!sheet) throw new ParseError('empty', 'The file has no data.');
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false, defval: null });
      return finish(matrix, encoding);
    }

    const wb = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
    const name = wb.SheetNames[0];
    const sheet = name ? wb.Sheets[name] : undefined;
    if (!sheet || !name) throw new ParseError('empty', 'The workbook has no sheets.');
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false, defval: null });
    return finish(matrix, 'xlsx', name);
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError('parse-failed', 'Could not read this file.');
  }
}
