import * as XLSX from 'xlsx';
import { sanitizeHeaders } from '../core/headers';
import { LIMITS, ParseError, type RawCell, type RawTable } from '../core/types';
import { detectDelimiter, parseCsv } from './csv';
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
  // Skip fully empty leading/trailing rows so the header row is the first real row.
  const isBlank = (row: unknown[]) => row.every((c) => toCell(c) === null);
  let first = 0;
  while (first < matrix.length && isBlank(matrix[first]!)) first++;
  let last = matrix.length - 1;
  while (last >= first && isBlank(matrix[last]!)) last--;
  if (first > last) throw new ParseError('empty', 'The file has no data.');

  const headerRow = matrix[first]!.map(toCell);
  const dataCount = last - first;
  if (headerRow.length > LIMITS.maxColumns) {
    throw new ParseError('too-many-columns', `More than ${LIMITS.maxColumns} columns.`);
  }
  if (dataCount > LIMITS.maxRows) {
    throw new ParseError('too-many-rows', `More than ${LIMITS.maxRows} rows.`);
  }

  // One pass: type each cell once, pad short rows with null, drop extra cells.
  const width = headerRow.length;
  const rows: RawCell[][] = new Array<RawCell[]>(dataCount);
  for (let i = 0; i < dataCount; i++) {
    const source = matrix[first + 1 + i]!;
    const out = new Array<RawCell>(width);
    for (let j = 0; j < width; j++) out[j] = j < source.length ? toCell(source[j]) : null;
    rows[i] = out;
  }
  const originalHeaders = headerRow.map((c) => (c === null ? '' : String(c)));
  return {
    headers: sanitizeHeaders(originalHeaders),
    originalHeaders,
    rows,
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
      // Direct RFC 4180 parse: every field stays text (we profile values ourselves) and no per-cell
      // objects are allocated, which keeps 100k-row files fast. Blank lines are dropped.
      const delimiter = fileName.toLowerCase().endsWith('.tsv') ? '\t' : detectDelimiter(text);
      const records = parseCsv(text, delimiter).filter((r) => !r.every((f) => f === ''));
      return finish(records, encoding);
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
