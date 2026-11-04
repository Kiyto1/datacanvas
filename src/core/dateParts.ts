/**
 * Calendar parts of a Date read from a spreadsheet.
 * SheetJS (cellDates) builds Dates whose LOCAL fields are the spreadsheet's wall-clock date, so the
 * local getters are correct. toISOString()/getUTC* shift the day for users east of UTC (e.g. Saudi
 * Arabia, UTC+3). Never format spreadsheet Dates with UTC methods.
 */
export function dateParts(d: Date): { y: number; m: number; d: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

export function formatDateParts(p: { y: number; m: number; d: number }): string {
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function packDate(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}
