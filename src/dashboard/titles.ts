import type { TFunction } from 'i18next';
import type { Aggregation, ColumnProfile } from '../core/types';
import type { ChartSpec } from './types';

function name(columns: ColumnProfile[], id: string | null): string {
  return columns.find((c) => c.id === id)?.displayName ?? '';
}

function measureLabel(t: TFunction, columns: ColumnProfile[], id: string | null, agg: Aggregation): string {
  return id === null ? t('dash.agg.records') : t('dash.agg.of', { agg: t(`dash.agg.${agg}`), column: name(columns, id) });
}

/** Titles are built from the spec at render time, so switching language retitles every chart. */
export function specTitle(t: TFunction, columns: ColumnProfile[], spec: ChartSpec): string {
  switch (spec.kind) {
    case 'kpi':
      return measureLabel(t, columns, spec.measure, spec.agg);
    case 'bar':
      return t('dash.title.by', {
        measure: measureLabel(t, columns, spec.measure, spec.measure ? spec.agg : 'count'),
        dimension: name(columns, spec.dimension),
      });
    case 'line':
      return t('dash.title.trend', { measure: measureLabel(t, columns, spec.measure, spec.agg) });
    case 'distribution':
      return t('dash.title.distribution', { dimension: name(columns, spec.dimension) });
    case 'scatter':
      return t('dash.title.scatter', { y: name(columns, spec.y), x: name(columns, spec.x) });
  }
}
