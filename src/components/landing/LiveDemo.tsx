import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { demoCsv } from '../../demo/sales';
import { applyOverride, type ChartOverride } from '../../dashboard/overrides';
import { recommend, resolveReadings } from '../../dashboard/recommend';
import type { ChartResult, ChartSpec, Filter } from '../../dashboard/types';
import { buildDisplayMap } from '../../normalize/layer';
import { suggestNormalizations } from '../../normalize/suggest';
import { parseFile } from '../../parse/parseFile';
import { inferColumns } from '../../profile/inferColumns';
import { runSpecs } from '../../worker/aggregate';
import { ColumnStore } from '../../worker/columnStore';
import { ChartPanel } from '../ChartPanel';
import { KpiStrip } from '../KpiStrip';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

/** The same engine the application runs, on the built-in sample, on the main thread (120 rows). */
function buildSample() {
  const table = parseFile(new TextEncoder().encode(demoCsv()).buffer as ArrayBuffer, 'sample.csv');
  const columns = inferColumns(table.headers, table.originalHeaders, table.rows);
  const suggestions = suggestNormalizations(columns, table.rows);
  const decisions = suggestions.map((s) => ({ columnId: s.columnId, from: s.variants.map((v) => v.value), to: s.suggestedDisplay }));
  const store = new ColumnStore(table, columns);
  const rec = recommend(columns, resolveReadings(columns, {}));
  const charts: ChartSpec[] = [];
  const line = rec.charts.find((c) => c.kind === 'line');
  if (line) charts.push(line);
  charts.push(...rec.charts.filter((c) => c.kind === 'bar').slice(0, 2));
  const mergedValues = suggestions.reduce((n, s) => n + s.variants.length, 0);
  return { columns, store, kpis: rec.kpis, charts, map: buildDisplayMap(decisions), mergedValues };
}

/**
 * An interactive product preview: click a city and every KPI and chart responds; switch the merge on
 * and watch the spellings collapse. These are the real dashboard components, not a mock.
 */
export default function LiveDemo() {
  const { t } = useTranslation();
  const sample = useMemo(() => buildSample(), []);
  const [merged, setMerged] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ChartOverride>>({});
  const [hidden, setHidden] = useState<string[]>([]);

  const charts = useMemo(
    () => sample.charts.map((c) => applyOverride(c, overrides[c.id], sample.columns)).filter((c) => !hidden.includes(c.id)),
    [sample, overrides, hidden],
  );

  const { results, baseline } = useMemo(() => {
    sample.store.setDecisions(merged ? sample.map : new Map());
    const all = runSpecs(sample.store, [...sample.kpis, ...charts], filters);
    const base = filters.length > 0 ? runSpecs(sample.store, sample.kpis, []) : [];
    const index = (list: ChartResult[]) => Object.fromEntries(list.map((r) => [r.id, r]));
    return { results: index(all), baseline: index(base) };
  }, [sample, charts, filters, merged]);

  const toggleFilter = (columnId: string, value: string) =>
    setFilters((current) => {
      const existing = current.find((f) => f.columnId === columnId);
      if (!existing) return [...current, { columnId, values: [value] }];
      const values = existing.values.includes(value) ? existing.values.filter((v) => v !== value) : [...existing.values, value];
      return values.length === 0 ? current.filter((f) => f.columnId !== columnId) : current.map((f) => (f.columnId === columnId ? { columnId, values } : f));
    });

  const nameOf = (id: string) => sample.columns.find((c) => c.id === id)?.displayName ?? id;

  return (
    <div className="window rounded-2xl border border-line bg-sunken p-4 sm:p-5" data-testid="live-demo">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-md bg-sunken px-2.5 py-1 text-sm">
          <Icon name="file" size={15} className="text-faint" />
          {t('live.file')}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted" role="status" data-testid="live-merge-status">
            {merged ? t('live.mergeOn', { count: sample.mergedValues }) : t('live.mergeOff')}
          </p>
          <Button
            variant={merged ? 'primary' : 'secondary'}
            size="sm"
            icon="wand"
            aria-pressed={merged}
            onClick={() => {
              setMerged((m) => !m);
              setFilters([]); // labels change when values merge
            }}
            data-testid="live-merge"
          >
            {t('live.merge')}
          </Button>
        </div>
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-2 pb-3" data-testid="live-filters">
        {filters.map((f) => (
          <button
            key={f.columnId}
            type="button"
            onClick={() => setFilters((c) => c.filter((x) => x.columnId !== f.columnId))}
            className="pop inline-flex items-center gap-2 rounded-full bg-brand-wash px-3 py-1 text-sm text-brand-strong"
            data-testid={`live-chip-${f.columnId}`}
          >
            {nameOf(f.columnId)}: {f.values.join('، ')}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        {filters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters([])} data-testid="live-clear">
            {t('dash.clearFilters')}
          </Button>
        )}
      </div>

      <KpiStrip kpis={sample.kpis} results={results} baseline={baseline} columns={sample.columns} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {charts.map((spec, i) => {
          const dimension = spec.kind === 'bar' || spec.kind === 'distribution' ? spec.dimension : null;
          return (
            <ChartPanel
              key={spec.id}
              index={i}
              spec={spec}
              result={results[spec.id]}
              columns={sample.columns}
              selected={dimension ? (filters.find((f) => f.columnId === dimension)?.values ?? []) : []}
              changed={overrides[spec.id] !== undefined}
              onSelect={toggleFilter}
              onChange={(patch) => setOverrides((o) => ({ ...o, [spec.id]: { ...o[spec.id], ...patch } }))}
              onReset={() =>
                setOverrides((o) => {
                  const { [spec.id]: _drop, ...rest } = o;
                  void _drop;
                  return rest;
                })
              }
              onHide={() => setHidden((h) => [...h, spec.id])}
            />
          );
        })}
      </div>
    </div>
  );
}
