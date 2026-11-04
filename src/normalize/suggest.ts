import { comparisonKey } from '../core/arabic';
import type { ColumnProfile, RawCell } from '../core/types';
import { aliasEntryFor, canonicalFor } from './aliases';
import type { NormalizationSuggestion, SuggestionKind, ValueVariant } from './types';

const MAX_DISTINCT = 5000;

/** ة and ه are only treated alike for *possible* matches; never merged automatically. */
function possibleKey(value: string): string {
  return comparisonKey(value).replace(/ة/g, 'ه');
}

class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root]!;
    while (this.parent[i] !== root) {
      const next = this.parent[i]!;
      this.parent[i] = root;
      i = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/** Finds groups of different spellings of the same value in one column. Suggestions only; nothing is changed. */
export function suggestForColumn(columnId: string, values: ReadonlyMap<string, number>): NormalizationSuggestion[] {
  const distinct = [...values.entries()].map(([value, count]) => ({ value, count }));
  if (distinct.length < 2 || distinct.length > MAX_DISTINCT) return [];

  const keys = distinct.map((d) => comparisonKey(d.value));
  const pKeys = distinct.map((d) => possibleKey(d.value));
  const aliases = distinct.map((d) => aliasEntryFor(d.value));

  const uf = new UnionFind(distinct.length);
  const exactByKey = new Map<string, number>();
  const aliasByEntry = new Map<number, number>();
  const possibleByKey = new Map<string, number>();
  const links: { a: number; b: number; kind: 'exact' | 'alias' | 'possible' }[] = [];

  distinct.forEach((_, i) => {
    const k = keys[i]!;
    const seenExact = exactByKey.get(k);
    if (seenExact === undefined) exactByKey.set(k, i);
    else {
      uf.union(seenExact, i);
      links.push({ a: seenExact, b: i, kind: 'exact' });
    }

    const entry = aliases[i];
    if (entry !== null && entry !== undefined) {
      const seenAlias = aliasByEntry.get(entry);
      if (seenAlias === undefined) aliasByEntry.set(entry, i);
      else {
        uf.union(seenAlias, i);
        // Same cleaned-up text is already an "exact" link; only different spellings need the alias table.
        if (keys[seenAlias] !== k) links.push({ a: seenAlias, b: i, kind: 'alias' });
      }
    }

    const pk = pKeys[i]!;
    const seenPossible = possibleByKey.get(pk);
    if (seenPossible === undefined) possibleByKey.set(pk, i);
    else if (keys[seenPossible] !== k) {
      uf.union(seenPossible, i);
      links.push({ a: seenPossible, b: i, kind: 'possible' });
    }
  });

  const groups = new Map<number, number[]>();
  distinct.forEach((_, i) => {
    const root = uf.find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  });

  const out: NormalizationSuggestion[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const memberSet = new Set(members);
    const kinds = new Set(links.filter((l) => memberSet.has(l.a)).map((l) => l.kind));
    const kind: SuggestionKind = kinds.has('possible') ? 'possible-match' : kinds.has('alias') ? 'known-alias' : 'exact';

    const variants: ValueVariant[] = members
      .map((i) => distinct[i]!)
      .sort((x, y) => y.count - x.count || x.value.localeCompare(y.value));
    const entry = members.map((i) => aliases[i]).find((e): e is number => e !== null && e !== undefined);
    const suggestedDisplay = kind !== 'possible-match' && entry !== undefined ? canonicalFor(entry) : variants[0]!.value;

    out.push({
      id: '',
      columnId,
      kind,
      variants,
      suggestedDisplay,
      totalCount: variants.reduce((sum, v) => sum + v.count, 0),
    });
  }
  // Safest first, then biggest impact; stable ids afterwards.
  const order: Record<SuggestionKind, number> = { exact: 0, 'known-alias': 1, 'possible-match': 2 };
  out.sort((a, b) => order[a.kind] - order[b.kind] || b.totalCount - a.totalCount);
  return out.map((s, i) => ({ ...s, id: `${columnId}:${i}` }));
}

/** Builds suggestions for every text category column. */
export function suggestNormalizations(columns: ColumnProfile[], rows: RawCell[][]): NormalizationSuggestion[] {
  const out: NormalizationSuggestion[] = [];
  columns.forEach((col, j) => {
    if (col.type !== 'string' || col.role !== 'dimension') return;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const cell = row[j];
      if (typeof cell === 'string') counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
    out.push(...suggestForColumn(col.id, counts));
  });
  return out;
}
