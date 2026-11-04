import { comparisonKey } from '../core/arabic';
import type { Aggregation, ColumnProfile, ColumnRole, ColumnType, RawCell, RoleSource } from '../core/types';
import { hintForHeader, type TermHint } from './dictionary';
import { inferDateColumn, type DateInference } from './dates';
import { parseNumber } from './numbers';

const SHARE = 0.95;
const BOOLEAN_WORDS = new Set(['true', 'false', 'yes', 'no', 'نعم', 'لا', 'صح', 'خطا']);

function cellKey(cell: Exclude<RawCell, null>): string {
  return cell instanceof Date ? cell.toISOString() : String(cell);
}

interface TypeResult {
  type: ColumnType;
  dateInference?: DateInference;
}

function inferType(cells: Exclude<RawCell, null>[]): TypeResult {
  const n = cells.length;
  if (n === 0) return { type: 'string' };
  const need = Math.ceil(n * SHARE);

  const booleans = cells.filter((c) => typeof c === 'boolean' || (typeof c === 'string' && BOOLEAN_WORDS.has(comparisonKey(c)))).length;
  if (booleans >= need) return { type: 'boolean' };

  const dateObjects = cells.filter((c) => c instanceof Date).length;
  if (dateObjects >= need) {
    const c = { order: 'ymd' as const, calendar: 'gregorian' as const };
    return { type: 'date', dateInference: { status: 'confirmed', candidates: [c], chosen: c } };
  }
  const strings = cells.filter((c): c is string => typeof c === 'string');
  if (strings.length >= need) {
    const dateInference = inferDateColumn(strings);
    if (dateInference) return { type: 'date', dateInference };
  }

  const numbers = cells.filter((c) => (typeof c === 'number' || typeof c === 'string') && parseNumber(c) !== null).length;
  if (numbers >= need) return { type: 'number' };
  return { type: 'string' };
}

function allIntegers(cells: Exclude<RawCell, null>[]): boolean {
  return cells.every((c) => {
    if (typeof c !== 'number' && typeof c !== 'string') return false;
    const v = parseNumber(c);
    return v !== null && Number.isInteger(v);
  });
}

interface RoleResult {
  role: ColumnRole;
  source: RoleSource;
  unitPrice: boolean;
}

function inferRole(
  type: ColumnType,
  hint: TermHint | null,
  cells: Exclude<RawCell, null>[],
  distinct: number,
): RoleResult {
  const header = (role: ColumnRole, unitPrice = false): RoleResult => ({ role, source: 'header', unitPrice });
  const data = (role: ColumnRole): RoleResult => ({ role, source: 'data', unitPrice: false });
  const n = cells.length;

  if (hint === 'identifier') return header('identifier');
  if (type === 'date' || type === 'boolean') return data('dimension');

  if (type === 'number') {
    if (hint === 'unit-price') return header('measure', true);
    if (hint === 'measure') return header('measure');
    if (hint === 'date' || hint === 'dimension' || hint === 'status') return header('dimension');
    if (n >= 10 && distinct / n >= SHARE && allIntegers(cells)) return data('identifier');
    return data('measure');
  }

  // string
  if (hint === 'dimension' || hint === 'status') return header('dimension');
  if (n >= 20 && distinct / n >= SHARE) return data('identifier');
  if (distinct <= Math.max(50, Math.floor(n * 0.05))) return data('dimension');
  return data('unknown');
}

function aggregationsFor(role: ColumnRole, unitPrice: boolean): { allowed: Aggregation[]; fallback: Aggregation } {
  if (role === 'measure') {
    return unitPrice
      ? { allowed: ['avg', 'min', 'max', 'count'], fallback: 'avg' }
      : { allowed: ['sum', 'avg', 'min', 'max', 'count'], fallback: 'sum' };
  }
  if (role === 'identifier') return { allowed: ['count', 'distinctCount'], fallback: 'distinctCount' };
  return { allowed: ['count', 'distinctCount'], fallback: 'count' };
}

/** Profiles every column: type, role (header dictionary first, then data), and allowed aggregations. */
export function inferColumns(headers: string[], originalHeaders: string[], rows: RawCell[][]): ColumnProfile[] {
  return headers.map((header, j) => {
    const cells: Exclude<RawCell, null>[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const cell = row[j] ?? null;
      if (cell === null) continue;
      cells.push(cell);
      seen.add(cellKey(cell));
    }

    const { type, dateInference } = inferType(cells);
    const hint = hintForHeader(header);
    const { role, source, unitPrice } = inferRole(type, hint, cells, seen.size);
    const { allowed, fallback } = aggregationsFor(role, unitPrice);

    return {
      id: `c${j}`,
      originalName: originalHeaders[j] ?? '',
      displayName: header,
      type,
      role,
      nullable: cells.length < rows.length,
      nonNullCount: cells.length,
      distinctCount: seen.size,
      nullRate: rows.length === 0 ? 0 : (rows.length - cells.length) / rows.length,
      allowedAggregations: allowed,
      defaultAggregation: fallback,
      roleSource: source,
      ...(dateInference ? { dateInference } : {}),
      ...(unitPrice ? { unitPrice: true } : {}),
    };
  });
}
