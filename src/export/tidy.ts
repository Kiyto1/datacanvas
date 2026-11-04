import { dateParts, formatDateParts } from '../core/dateParts';
import type { ColumnRole } from '../core/types';
import { comparisonKey } from '../core/arabic';
import { displayCell, summarizeChanges } from '../normalize/layer';
import type { ColumnStore } from '../worker/columnStore';

export type ExportType = 'number' | 'date' | 'boolean' | 'text';

export interface DateCell {
  y: number;
  m: number;
  d: number;
}
export type ExportCell = string | number | boolean | DateCell | null;

export interface ExportColumn {
  /** ASCII-safe stable id (c0, c1, ...). Column names may be Arabic. */
  id: string;
  name: string;
  originalName: string;
  type: ExportType;
  role: ColumnRole;
  nullable: boolean;
  nonNullCount: number;
  distinctCount: number;
  /** Human-readable facts about this column's export (fallbacks, merges, calendars). */
  notes: string[];
}

export interface TidyTable {
  columns: ExportColumn[];
  rows: ExportCell[][];
}

const TRUE_WORDS = new Set(['true', 'yes', 'نعم', 'صح']);
const FALSE_WORDS = new Set(['false', 'no', 'لا', 'خطا']);

function parseBoolean(cell: unknown): boolean | null {
  if (typeof cell === 'boolean') return cell;
  if (typeof cell !== 'string') return null;
  const key = comparisonKey(cell);
  if (TRUE_WORDS.has(key)) return true;
  if (FALSE_WORDS.has(key)) return false;
  return null;
}

function textOf(cell: unknown): string {
  if (cell instanceof Date) return formatDateParts(dateParts(cell));
  return String(cell);
}

/**
 * Builds the typed, cleaned table every export reads from. The export contract:
 * - values are the approved (merged) display values; originals in the worker are never touched;
 * - numbers keep full precision; booleans are true/false; missing values are null;
 * - dates are exported only when their reading is known (Gregorian); otherwise the column is text;
 * - a column whose values don't all fit its detected type is exported as text and flagged.
 */
export function buildTidyTable(store: ColumnStore): TidyTable {
  const ids = store.columns.map((c) => c.id);
  const changes = summarizeChanges(store.table.rows, ids, store.displayMap);
  const mergedByColumn = new Map<string, number>();
  for (const c of changes) mergedByColumn.set(c.columnId, (mergedByColumn.get(c.columnId) ?? 0) + c.count);

  const rowCount = store.rowCount;
  const columns: ExportColumn[] = [];
  const cells: ExportCell[][] = Array.from({ length: rowCount }, () => new Array<ExportCell>(store.columns.length).fill(null));

  store.columns.forEach((profile, j) => {
    const notes: string[] = [];
    const raw = (i: number) => store.table.rows[i]?.[j] ?? null;
    const asText = (): ExportCell[] =>
      Array.from({ length: rowCount }, (_, i) => {
        const cell = displayCell(profile.id, raw(i), store.displayMap);
        return cell === null ? null : textOf(cell);
      });

    let type: ExportType = 'text';
    let values: ExportCell[] | null = null;

    if (profile.type === 'number') {
      const nums = store.numeric(profile.id);
      let failures = 0;
      const out: ExportCell[] = new Array<ExportCell>(rowCount).fill(null);
      for (let i = 0; i < rowCount; i++) {
        if (raw(i) === null) continue;
        if (Number.isNaN(nums[i]!)) failures++;
        else out[i] = nums[i]!;
      }
      if (failures === 0) {
        type = 'number';
        values = out;
      } else {
        notes.push(`type-fallback: ${failures} value(s) were not plain numbers, so the column is exported as text`);
      }
    } else if (profile.type === 'date') {
      const reading = store.readingFor(profile.id);
      if (!reading) {
        notes.push('date-unconfirmed: the day/month order was not confirmed, so dates are exported as the original text');
      } else if (reading.calendar === 'hijri') {
        notes.push('hijri: Hijri dates are exported as the original text, without conversion');
      } else {
        const packed = store.dates(profile.id)!;
        let failures = 0;
        const out: ExportCell[] = new Array<ExportCell>(rowCount).fill(null);
        for (let i = 0; i < rowCount; i++) {
          if (raw(i) === null) continue;
          const p = packed[i]!;
          if (Number.isNaN(p)) failures++;
          else out[i] = { y: Math.floor(p / 10000), m: Math.floor((p % 10000) / 100), d: p % 100 };
        }
        if (failures === 0) {
          type = 'date';
          values = out;
          notes.push(`date-format: ISO 8601 (yyyy-mm-dd), read as ${reading.order}`);
        } else {
          notes.push(`type-fallback: ${failures} value(s) were not valid dates, so the column is exported as text`);
        }
      }
    } else if (profile.type === 'boolean') {
      let failures = 0;
      const out: ExportCell[] = new Array<ExportCell>(rowCount).fill(null);
      for (let i = 0; i < rowCount; i++) {
        const cell = raw(i);
        if (cell === null) continue;
        const b = parseBoolean(cell);
        if (b === null) failures++;
        else out[i] = b;
      }
      if (failures === 0) {
        type = 'boolean';
        values = out;
      } else {
        notes.push(`type-fallback: ${failures} value(s) were not yes/no values, so the column is exported as text`);
      }
    }

    const final = values ?? asText();
    const merged = mergedByColumn.get(profile.id) ?? 0;
    if (merged > 0) notes.push(`merged: ${merged} value(s) were changed by merges you approved`);

    let nonNull = 0;
    const distinct = new Set<string>();
    for (let i = 0; i < rowCount; i++) {
      const v = final[i] ?? null;
      cells[i]![j] = v;
      if (v !== null) {
        nonNull++;
        distinct.add(typeof v === 'object' ? `${v.y}-${v.m}-${v.d}` : String(v));
      }
    }
    columns.push({
      id: profile.id,
      name: profile.displayName,
      originalName: profile.originalName,
      type,
      role: profile.role,
      nullable: nonNull < rowCount,
      nonNullCount: nonNull,
      distinctCount: distinct.size,
      notes,
    });
  });

  return { columns, rows: cells };
}

export function isoDate(d: DateCell): string {
  return formatDateParts({ y: d.y, m: d.m, d: d.d });
}
