import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import { applyOverride } from '../dashboard/overrides';
import { recommend, resolveReadings } from '../dashboard/recommend';
import { useDashboard } from '../store/dashboard';
import { ChartPanel } from './ChartPanel';
import { KpiStrip } from './KpiStrip';
import { Button } from './ui/Button';

interface Props {
  columns: ColumnProfile[];
  /** Changes whenever approved normalization changes, so results are recomputed. */
  dataVersion: unknown;
}

export function Dashboard({ columns, dataVersion }: Props) {
  const { t } = useTranslation();
  const {
    filters,
    dateChoices,
    overrides,
    hidden,
    results,
    baseline,
    loading,
    failed,
    toggleFilter,
    removeFilter,
    clearFilters,
    setOverride,
    resetOverride,
    hideChart,
    showAllCharts,
    refresh,
  } = useDashboard();

  const rec = useMemo(() => recommend(columns, resolveReadings(columns, dateChoices)), [columns, dateChoices]);
  // Recommended charts with the person's changes applied; hidden ones are dropped from view and from the request.
  const charts = useMemo(
    () => rec.charts.map((spec) => applyOverride(spec, overrides[spec.id], columns)).filter((spec) => !hidden.includes(spec.id)),
    [rec, overrides, hidden, columns],
  );
  const specs = useMemo(() => [...rec.kpis, ...charts], [rec, charts]);

  // Merged values change the labels filters refer to, so start from a clean slate.
  useEffect(() => {
    clearFilters();
  }, [dataVersion, clearFilters]);

  useEffect(() => {
    void refresh(specs, rec.kpis);
  }, [specs, rec.kpis, filters, dataVersion, refresh]);

  const nameOf = (id: string) => columns.find((c) => c.id === id)?.displayName ?? id;

  return (
    <section aria-label={t('dash.title.page')} className="flex flex-col gap-5" data-testid="dashboard">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {loading && (
          <span role="status" className="text-sm text-muted">
            {t('dash.loading')}
          </span>
        )}
        {failed && (
          <span role="alert" className="text-sm text-danger">
            {t('dash.failed')}
          </span>
        )}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" data-testid="filter-bar">
            {filters.map((f) => (
              <button
                key={f.columnId}
                type="button"
                className="pop inline-flex items-center gap-2 rounded-full bg-brand-wash px-3 py-1 text-sm text-brand-strong transition-colors hover:bg-brand-wash/70"
                onClick={() => removeFilter(f.columnId)}
                aria-label={t('dash.removeFilter', { column: nameOf(f.columnId) })}
                data-testid={`chip-${f.columnId}`}
              >
                {nameOf(f.columnId)}: {f.values.join('، ')}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters">
              {t('dash.clearFilters')}
            </Button>
          </div>
        )}
        {hidden.length > 0 && (
          <Button variant="ghost" size="sm" className="ms-auto" onClick={showAllCharts} data-testid="show-hidden">
            {t('ws.hidden', { count: hidden.length })}
          </Button>
        )}
      </div>

      <KpiStrip kpis={rec.kpis} results={results} baseline={baseline} columns={columns} />

      <div className="grid gap-5 lg:grid-cols-2">
        {charts.map((spec, i) => {
          const dimension = spec.kind === 'bar' || spec.kind === 'distribution' ? spec.dimension : null;
          return (
            <ChartPanel
              key={spec.id}
              index={i}
              spec={spec}
              result={results[spec.id]}
              columns={columns}
              selected={dimension ? (filters.find((f) => f.columnId === dimension)?.values ?? []) : []}
              changed={overrides[spec.id] !== undefined}
              onSelect={(columnId, label) => toggleFilter(columnId, label)}
              onChange={(patch) => setOverride(spec.id, patch)}
              onReset={() => resetOverride(spec.id)}
              onHide={() => hideChart(spec.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
