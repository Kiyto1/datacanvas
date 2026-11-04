import { describe, expect, it } from 'vitest';
import type { RawCell } from '../core/types';
import { inferColumns } from '../profile/inferColumns';
import { aliasEntryFor } from './aliases';
import { buildDisplayMap, displayCell, summarizeChanges } from './layer';
import { decisionsSchema } from './schema';
import { suggestForColumn, suggestNormalizations } from './suggest';

const counts = (pairs: [string, number][]) => new Map(pairs);

describe('suggestForColumn', () => {
  it('groups Riyadh / الرياض / الرّياض and Jeddah / جدة as in the brief', () => {
    const s = suggestForColumn(
      'c0',
      counts([
        ['الرياض', 1],
        ['Riyadh', 1],
        ['الرّياض', 1],
        ['جدة', 1],
        ['Jeddah', 1],
      ]),
    );
    expect(s).toHaveLength(2);
    const riyadh = s.find((x) => x.variants.some((v) => v.value === 'Riyadh'))!;
    expect(riyadh.kind).toBe('known-alias');
    expect(riyadh.suggestedDisplay).toBe('الرياض');
    expect(riyadh.variants.map((v) => v.value).sort()).toEqual(['Riyadh', 'الرياض', 'الرّياض'].sort());
    const jeddah = s.find((x) => x.variants.some((v) => v.value === 'Jeddah'))!;
    expect(jeddah.suggestedDisplay).toBe('جدة');
    expect(jeddah.totalCount).toBe(2);
  });

  it('labels spacing/diacritic-only differences as exact and keeps the most frequent spelling', () => {
    const s = suggestForColumn('c0', counts([['الرياض', 5], ['الرياض ', 1], ['الرّياض', 2]]));
    expect(s).toHaveLength(1);
    expect(s[0]?.kind).toBe('exact');
    expect(s[0]?.suggestedDisplay).toBe('الرياض');
  });

  it('flags ة/ه differences only as a possible match with no alias canonical', () => {
    const s = suggestForColumn('c0', counts([['مدرسة', 3], ['مدرسه', 1]]));
    expect(s).toHaveLength(1);
    expect(s[0]?.kind).toBe('possible-match');
    expect(s[0]?.suggestedDisplay).toBe('مدرسة');
  });

  it('does not suggest anything for unrelated values or a single spelling', () => {
    expect(suggestForColumn('c0', counts([['الرياض', 3], ['جدة', 2], ['الدمام', 1]]))).toEqual([]);
    expect(suggestForColumn('c0', counts([['الرياض', 3]]))).toEqual([]);
  });

  it('keeps generic words out of the alias table', () => {
    expect(aliasEntryFor('المدينة')).toBeNull();
    expect(aliasEntryFor('riyadh')).not.toBeNull();
  });

  it('orders safer suggestions first and assigns stable ids', () => {
    const s = suggestForColumn(
      'c1',
      counts([['مدرسة', 3], ['مدرسه', 1], ['Riyadh', 2], ['الرياض', 1]]),
    );
    expect(s.map((x) => x.kind)).toEqual(['known-alias', 'possible-match']);
    expect(s.map((x) => x.id)).toEqual(['c1:0', 'c1:1']);
  });
});

describe('suggestNormalizations', () => {
  it('only inspects text category columns', () => {
    const headers = ['المدينة', 'المبيعات'];
    const rows: RawCell[][] = [
      ['الرياض', '5,000'],
      ['Riyadh', '3,000'],
      ['جدة', '4,000'],
    ];
    const cols = inferColumns(headers, headers, rows);
    const s = suggestNormalizations(cols, rows);
    expect(s).toHaveLength(1);
    expect(s[0]?.columnId).toBe('c0');
  });
});

describe('reversible display layer', () => {
  const map = buildDisplayMap([{ columnId: 'c0', from: ['Riyadh', 'الرّياض', 'الرياض'], to: 'الرياض' }]);

  it('maps approved values and leaves everything else untouched', () => {
    expect(displayCell('c0', 'Riyadh', map)).toBe('الرياض');
    expect(displayCell('c0', 'جدة', map)).toBe('جدة');
    expect(displayCell('c1', 'Riyadh', map)).toBe('Riyadh'); // other column unaffected
    expect(displayCell('c0', 5000, map)).toBe(5000);
    expect(displayCell('c0', null, map)).toBeNull();
  });

  it('does not mutate the original rows and undo (empty decisions) restores them', () => {
    const rows: RawCell[][] = [['Riyadh', 1], ['جدة', 2]];
    const snapshot = JSON.stringify(rows);
    const shown = rows.map((r) => r.map((c, j) => displayCell(`c${j}`, c, map)));
    expect(shown[0]?.[0]).toBe('الرياض');
    expect(JSON.stringify(rows)).toBe(snapshot);
    const undone = buildDisplayMap([]);
    expect(rows.map((r) => r.map((c, j) => displayCell(`c${j}`, c, undone)))).toEqual(rows);
  });

  it('summarizes how many cells each merge changes', () => {
    const rows: RawCell[][] = [['Riyadh'], ['Riyadh'], ['الرياض'], ['جدة']];
    expect(summarizeChanges(rows, ['c0'], map)).toEqual([{ columnId: 'c0', from: 'Riyadh', to: 'الرياض', count: 2 }]);
  });
});

describe('decision validation', () => {
  it('rejects malformed decisions', () => {
    expect(decisionsSchema.safeParse([{ columnId: 'c0', from: [], to: 'x' }]).success).toBe(false);
    expect(decisionsSchema.safeParse([{ columnId: 'c0', from: ['a'], to: '' }]).success).toBe(false);
    expect(decisionsSchema.safeParse([{ columnId: 'c0', from: ['a'], to: 'b' }]).success).toBe(true);
  });
});
