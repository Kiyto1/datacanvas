import * as XLSX from 'xlsx';
import type { TidyTable } from './tidy';

function sheetName(requested: string): string {
  // Excel: max 31 chars, none of : \ / ? * [ ]
  const cleaned = requested.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned === '' ? 'data' : cleaned;
}

/** Excel's hard limit; beyond this a sheet cannot hold the data. */
export const XLSX_MAX_ROWS = 1_048_575; // plus the header row

/**
 * Writes a workbook with typed cells. Text is always a string-typed cell, so a value like
 * "=SUM(A1)" is stored as text and can never execute. Dates are real Excel dates (yyyy-mm-dd).
 * Uses SheetJS dense mode (an array of rows) so building the sheet does not encode a cell
 * address per cell, which was the slow part for large tables.
 */
export function toXlsx(table: TidyTable, options: { sheet: string; rtl: boolean }): Uint8Array {
  if (table.rows.length > XLSX_MAX_ROWS) throw new Error('Too many rows for an Excel sheet.');

  const data: XLSX.CellObject[][] = new Array<XLSX.CellObject[]>(table.rows.length + 1);
  data[0] = table.columns.map((col): XLSX.CellObject => ({ t: 's', v: col.name }));
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r]!;
    const out = new Array<XLSX.CellObject>(row.length);
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) out[c] = { t: 'z' }; // stub: genuinely empty cell
      else if (typeof cell === 'number') out[c] = { t: 'n', v: cell };
      else if (typeof cell === 'boolean') out[c] = { t: 'b', v: cell };
      else if (typeof cell === 'string') out[c] = { t: 's', v: cell };
      else out[c] = { t: 'd', v: new Date(cell.y, cell.m - 1, cell.d), z: 'yyyy-mm-dd' };
    }
    data[r + 1] = out;
  }

  const ws: XLSX.WorkSheet = { '!data': data };
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: table.rows.length, c: Math.max(0, table.columns.length - 1) } });
  ws['!cols'] = table.columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.name.length + 2)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName(options.sheet));
  if (options.rtl) wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
  return new Uint8Array(out);
}
