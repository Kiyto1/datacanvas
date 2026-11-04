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

/** Type detection only needs a representative slice; counting/distinct use every row. */
const SAMPLE_SIZE = 5000;

type Cells = Exclude<RawCell, null>[];

function evenSample(cells: Cells): Cells {
  if (cells.length <= SAMPLE_SIZE) return cells;
  const step = cells.length / SAMPLE_SIZE;
  return Array.from({ length: SAMPLE_SIZE }, (_, i) => cells[Math.floor(i * step)]!);
}

/** `cells` is the sample used for the share tests; `all` is every non-null value (for date evidence). */
function inferType(cells: Cells, all: Cells): TypeResult {
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
    let dateInference = inferDateColumn(strings);
    // It looks like dates on the sample: decide the day/month order from EVERY value, not just the sample.
    if (dateInference && all.length > cells.length) {
      dateInference = inferDateColumn(all.filter((c): c is string => typeof c === 'string'));
    }
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
  n: number,
  sampleCells: Cells,
  distinct: number,
): RoleResult {
  const header = (role: ColumnRole, unitPrice = false): RoleResult => ({ role, source: 'header', unitPrice });
  const data = (role: ColumnRole): RoleResult => ({ role, source: 'data', unitPrice: false });

  if (hint === 'identifier') return header('identifier');
  if (type === 'date' || type === 'boolean') return data('dimension');

  if (type === 'number') {
    if (hint === 'unit-price') return header('measure', true);
    if (hint === 'measure') return header('measure');
    if (hint === 'date' || hint === 'dimension' || hint === 'status') return header('dimension');
    if (n >= 10 && distinct / n >= SHARE && allIntegers(sampleCells)) return data('identifier');
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

    const sample = evenSample(cells);
    const { type, dateInference } = inferType(sample, cells);
    const hint = hintForHeader(header);
    const { role, source, unitPrice } = inferRole(type, hint, cells.length, sample, seen.size);
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
