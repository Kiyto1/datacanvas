import type { ChangeLogEntry, NormalizationDecision } from './types';
import type { RawCell } from '../core/types';

// Pure display layer, shared by the worker and the landing-page demo. It must not import Zod:
// the validation schema lives in ./schema.ts and is only used by the worker.

/** columnId -> (original value -> approved display value) */
export type DisplayMap = Map<string, Map<string, string>>;

export function buildDisplayMap(decisions: readonly NormalizationDecision[]): DisplayMap {
  const map: DisplayMap = new Map();
  for (const d of decisions) {
    let column = map.get(d.columnId);
    if (!column) map.set(d.columnId, (column = new Map()));
    for (const from of d.from) if (from !== d.to) column.set(from, d.to);
  }
  return map;
}

/** Display value for a cell. Non-text and unmapped values come back untouched. The stored original is never modified. */
export function displayCell(columnId: string, cell: RawCell, map: DisplayMap): RawCell {
  if (typeof cell !== 'string') return cell;
  return map.get(columnId)?.get(cell) ?? cell;
}

/** Counts how many cells each approved merge changes, for the visible change log. */
export function summarizeChanges(
  rows: readonly RawCell[][],
  columnIds: readonly string[],
  map: DisplayMap,
): ChangeLogEntry[] {
  const counts = new Map<string, ChangeLogEntry>();
  columnIds.forEach((columnId, j) => {
    const column = map.get(columnId);
    if (!column) return;
    for (const row of rows) {
      const cell = row[j];
      if (typeof cell !== 'string') continue;
      const to = column.get(cell);
      if (to === undefined) continue;
      const key = `${columnId}\u0000${cell}`;
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { columnId, from: cell, to, count: 1 });
    }
  });
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
