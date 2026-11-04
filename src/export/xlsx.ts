import * as XLSX from 'xlsx';
import type { TidyTable } from './tidy';

function sheetName(requested: string): string {
  // Excel: max 31 chars, none of : \ / ? * [ ]
  const cleaned = requested.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned === '' ? 'data' : cleaned;
}

/**
 * Writes a workbook with typed cells. Text is always a string-typed cell, so a value like
 * "=SUM(A1)" is stored as text and can never execute. Dates are real Excel dates (yyyy-mm-dd).
 */
export function toXlsx(table: TidyTable, options: { sheet: string; rtl: boolean }): Uint8Array {
  const ws: XLSX.WorkSheet = {};
  table.columns.forEach((col, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: col.name };
  });
  table.rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === null) return;
      const addr = XLSX.utils.encode_cell({ r: r + 1, c });
      if (typeof cell === 'number') ws[addr] = { t: 'n', v: cell };
      else if (typeof cell === 'boolean') ws[addr] = { t: 'b', v: cell };
      else if (typeof cell === 'string') ws[addr] = { t: 's', v: cell };
      else ws[addr] = { t: 'd', v: new Date(cell.y, cell.m - 1, cell.d), z: 'yyyy-mm-dd' };
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: table.rows.length, c: Math.max(0, table.columns.length - 1) } });
  ws['!cols'] = table.columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.name.length + 2)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName(options.sheet));
  if (options.rtl) wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
  return new Uint8Array(out);
}
