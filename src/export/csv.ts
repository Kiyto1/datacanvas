import { parseNumber } from '../profile/numbers';
import { isoDate, type ExportCell, type TidyTable } from './tidy';

/**
 * Spreadsheet apps run text that starts with = + - @ (or tab/CR) as a formula. Neutralise such TEXT
 * cells with a leading apostrophe. Typed numbers are never touched, so -1500 stays a number, and a
 * text that is itself a plain number (e.g. "+966501234567") is left alone.
 */
export function neutralizeFormula(text: string): string {
  if (text === '') return text;
  const first = text[0]!;
  if (first === '=' || first === '@' || first === '\t' || first === '\r') return `'${text}`;
  if ((first === '+' || first === '-') && parseNumber(text) === null) return `'${text}`;
  return text;
}

/** Full-precision decimal text with '.' and no grouping or exponent. */
export function plainNumber(n: number): string {
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
}

function field(cell: ExportCell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return plainNumber(cell);
  if (typeof cell === 'boolean') return cell ? 'true' : 'false';
  if (typeof cell === 'object') return isoDate(cell);
  return quote(neutralizeFormula(cell));
}

function quote(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function headerField(name: string): string {
  return quote(neutralizeFormula(name));
}

/** RFC 4180 CSV, UTF-8 with BOM so Excel shows Arabic correctly. */
export function toCsv(table: TidyTable, options: { bom?: boolean } = {}): Uint8Array {
  const lines: string[] = [table.columns.map((c) => headerField(c.name)).join(',')];
  for (const row of table.rows) lines.push(row.map(field).join(','));
  const body = new TextEncoder().encode(lines.join('\r\n') + '\r\n');
  if (options.bom === false) return body;
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}
