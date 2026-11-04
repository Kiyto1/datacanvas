import { dateParts, formatDateParts, packDate } from '../core/dateParts';
import type { ColumnProfile, RawCell, RawTable } from '../core/types';
import { displayCell, type DisplayMap } from '../normalize/layer';
import { parseDateWith, type DateCandidate } from '../profile/dates';
import { parseNumber } from '../profile/numbers';

export interface Categorical {
  codes: Int32Array; // -1 = missing
  labels: string[];
  index: Map<string, number>;
}

function labelFor(cell: Exclude<RawCell, null>): string {
  return cell instanceof Date ? formatDateParts(dateParts(cell)) : String(cell);
}

/**
 * Lazily builds typed, cached columns from the raw table, always reading through the approved
 * normalization map and chosen date readings. Original rows are never modified.
 */
let storeCounter = 0;

export class ColumnStore {
  /** Unique per store so caches never leak across datasets. */
  readonly uid = ++storeCounter;
  version = 0;
  private decisions: DisplayMap = new Map();
  private readings = new Map<string, DateCandidate>();
  private numericCache = new Map<string, Float64Array>();
  private categoricalCache = new Map<string, Categorical>();
  private dateCache = new Map<string, Float64Array | null>();
  private readonly index: Map<string, number>;

  constructor(
    readonly table: RawTable,
    readonly columns: ColumnProfile[],
  ) {
    this.index = new Map(columns.map((c, j) => [c.id, j]));
  }

  get rowCount(): number {
    return this.table.rows.length;
  }

  hasColumn(id: string): boolean {
    return this.index.has(id);
  }

  profile(id: string): ColumnProfile {
    const j = this.index.get(id);
    if (j === undefined) throw new Error(`Unknown column ${id}`);
    return this.columns[j]!;
  }

  private invalidate(): void {
    this.version++;
    this.numericCache.clear();
    this.categoricalCache.clear();
    this.dateCache.clear();
  }

  /** Approved merges, for exports and the dictionary. Read-only view. */
  get displayMap(): DisplayMap {
    return this.decisions;
  }

  setDecisions(map: DisplayMap): void {
    this.decisions = map;
    this.invalidate();
  }

  setReading(columnId: string, candidate: DateCandidate): void {
    this.readings.set(columnId, candidate);
    this.invalidate();
  }

  readingFor(columnId: string): DateCandidate | null {
    return this.readings.get(columnId) ?? this.profile(columnId).dateInference?.chosen ?? null;
  }

  private colIndex(id: string): number {
    const j = this.index.get(id);
    if (j === undefined) throw new Error(`Unknown column ${id}`);
    return j;
  }

  /** NaN = missing or not a plain number. */
  numeric(id: string): Float64Array {
    const cached = this.numericCache.get(id);
    if (cached) return cached;
    const j = this.colIndex(id);
    const out = new Float64Array(this.rowCount);
    this.table.rows.forEach((row, i) => {
      const cell = row[j];
      const v = typeof cell === 'number' || typeof cell === 'string' ? parseNumber(cell) : null;
      out[i] = v === null ? Number.NaN : v;
    });
    this.numericCache.set(id, out);
    return out;
  }

  /** Dictionary-encoded display values (after approved merges). */
  categorical(id: string): Categorical {
    const cached = this.categoricalCache.get(id);
    if (cached) return cached;
    const j = this.colIndex(id);
    const codes = new Int32Array(this.rowCount);
    const labels: string[] = [];
    const index = new Map<string, number>();
    this.table.rows.forEach((row, i) => {
      const cell = displayCell(id, row[j] ?? null, this.decisions);
      if (cell === null) {
        codes[i] = -1;
        return;
      }
      const label = labelFor(cell);
      let code = index.get(label);
      if (code === undefined) {
        code = labels.length;
        labels.push(label);
        index.set(label, code);
      }
      codes[i] = code;
    });
    const result = { codes, labels, index };
    this.categoricalCache.set(id, result);
    return result;
  }

  /** Packed yyyymmdd (NaN = missing). Null when the column's reading is not resolved yet. */
  dates(id: string): Float64Array | null {
    if (this.dateCache.has(id)) return this.dateCache.get(id)!;
    const reading = this.readingFor(id);
    if (!reading) {
      this.dateCache.set(id, null);
      return null;
    }
    const j = this.colIndex(id);
    const out = new Float64Array(this.rowCount);
    this.table.rows.forEach((row, i) => {
      const cell = row[j];
      let packed = Number.NaN;
      if (cell instanceof Date) {
        const p = dateParts(cell);
        packed = packDate(p.y, p.m, p.d);
      } else if (typeof cell === 'string') {
        const p = parseDateWith(cell, reading);
        if (p) packed = packDate(p.y, p.m, p.d);
      }
      out[i] = packed;
    });
    this.dateCache.set(id, out);
    return out;
  }
}
