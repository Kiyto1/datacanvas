import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnProfile } from '../core/types';
import { recommend, resolveReadings } from '../dashboard/recommend';
import { useDashboard } from '../store/dashboard';
import { ChartPanel } from './ChartPanel';
import { KpiStrip } from './KpiStrip';

interface Props {
  columns: ColumnProfile[];
  /** Changes whenever approved normalization changes, so results are recomputed. */
  dataVersion: unknown;
}

export function Dashboard({ columns, dataVersion }: Props) {
  const { t } = useTranslation();
  const { filters, dateChoices, results, loading, failed, toggleFilter, removeFilter, clearFilters, refresh } = useDashboard();

  const rec = useMemo(() => recommend(columns, resolveReadings(columns, dateChoices)), [columns, dateChoices]);
  const specs = useMemo(() => [...rec.kpis, ...rec.charts], [rec]);

  // Merged values change the labels filters refer to, so start from a clean slate.
  useEffect(() => {
    clearFilters();
  }, [dataVersion, clearFilters]);

  useEffect(() => {
    void refresh(specs);
  }, [specs, filters, dataVersion, refresh]);

  const nameOf = (id: string) => columns.find((c) => c.id === id)?.displayName ?? id;

  return (
    <section aria-label={t('dash.title.page')} className="flex flex-col gap-6" data-testid="dashboard">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t('dash.title.page')}</h2>
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
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="filter-bar">
          {filters.map((f) => (
            <button
              key={f.columnId}
              type="button"
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand"
              onClick={() => removeFilter(f.columnId)}
              aria-label={t('dash.removeFilter', { column: nameOf(f.columnId) })}
              data-testid={`chip-${f.columnId}`}
            >
              {nameOf(f.columnId)}: {f.values.join('، ')} ×
            </button>
          ))}
          <button type="button" className="text-sm text-brand hover:underline" onClick={clearFilters} data-testid="clear-filters">
            {t('dash.clearFilters')}
          </button>
        </div>
      )}

      <KpiStrip kpis={rec.kpis} results={results} columns={columns} />

      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
        {rec.charts.map((spec) => {
          const dimension = spec.kind === 'bar' || spec.kind === 'distribution' ? spec.dimension : null;
          return (
            <ChartPanel
              key={spec.id}
              spec={spec}
              result={results[spec.id]}
              columns={columns}
              selected={dimension ? (filters.find((f) => f.columnId === dimension)?.values ?? []) : []}
              onSelect={(columnId, label) => toggleFilter(columnId, label)}
            />
          );
        })}
      </div>
    </section>
  );
}
