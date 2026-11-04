import type { ChangeLogEntry } from '../normalize/types';
import { isoDate, type ExportType, type TidyTable } from './tidy';

export interface DataDictionary {
  format: 'datacanvas-data-dictionary';
  version: 1;
  dataset: { name: string; rowCount: number; exportedAt: string };
  conventions: {
    encoding: 'UTF-8';
    delimiter: ',';
    decimalSeparator: '.';
    dates: 'ISO 8601 yyyy-mm-dd, no time zone conversion';
    booleans: 'true / false';
    missingValues: 'empty field';
  };
  columns: {
    id: string;
    name: string;
    originalName: string;
    type: ExportType;
    role: string;
    nullable: boolean;
    nonNullCount: number;
    distinctCount: number;
    notes: string[];
  }[];
  /** Merges the user approved before export (value counts only; no other data). */
  appliedMerges: { column: string; from: string; to: string; count: number }[];
}

export function buildDictionary(
  table: TidyTable,
  meta: { name: string; exportedAt: string },
  changes: ChangeLogEntry[],
): DataDictionary {
  const nameOf = (id: string) => table.columns.find((c) => c.id === id)?.name ?? id;
  return {
    format: 'datacanvas-data-dictionary',
    version: 1,
    dataset: { name: meta.name, rowCount: table.rows.length, exportedAt: meta.exportedAt },
    conventions: {
      encoding: 'UTF-8',
      delimiter: ',',
      decimalSeparator: '.',
      dates: 'ISO 8601 yyyy-mm-dd, no time zone conversion',
      booleans: 'true / false',
      missingValues: 'empty field',
    },
    columns: table.columns.map((c) => ({
      id: c.id,
      name: c.name,
      originalName: c.originalName,
      type: c.type,
      role: c.role,
      nullable: c.nullable,
      nonNullCount: c.nonNullCount,
      distinctCount: c.distinctCount,
      notes: c.notes,
    })),
    appliedMerges: changes.map((c) => ({ column: nameOf(c.columnId), from: c.from, to: c.to, count: c.count })),
  };
}

/** Rows as objects keyed by (unique) column name, for the JSON export. */
export function toJsonRows(table: TidyTable): Record<string, unknown>[] {
  return table.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    table.columns.forEach((col, j) => {
      const cell = row[j] ?? null;
      obj[col.name] = cell !== null && typeof cell === 'object' ? isoDate(cell) : cell;
    });
    return obj;
  });
}
