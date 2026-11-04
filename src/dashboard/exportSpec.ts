import type { ColumnProfile } from '../core/types';
import type { DateReadings, Recommendation } from './recommend';
import type { ChartSpec } from './types';

/**
 * DataCanvas-native description of the dashboard, by column NAME (not internal id) so it can be
 * read by a person or matched to another compatible file later. It documents how to recreate the
 * charts elsewhere. It is NOT a Power BI or Metabase import format and contains no data values.
 */
export function buildDashboardSpec(columns: ColumnProfile[], rec: Recommendation, readings: DateReadings, datasetName: string): string {
  const name = (id: string | null) => (id === null ? null : (columns.find((c) => c.id === id)?.displayName ?? id));
  const describe = (spec: ChartSpec) => {
    switch (spec.kind) {
      case 'kpi':
        return { kind: 'kpi', measure: name(spec.measure), aggregation: spec.agg };
      case 'bar':
        return { kind: 'bar', groupBy: name(spec.dimension), measure: name(spec.measure), aggregation: spec.measure ? spec.agg : 'count', topN: spec.topN };
      case 'line':
        return { kind: 'line', dateColumn: name(spec.date), measure: name(spec.measure), aggregation: spec.agg, granularity: 'auto (day up to ~2 months, then month, then year)' };
      case 'distribution':
        return { kind: 'distribution', groupBy: name(spec.dimension), aggregation: 'count' };
      case 'scatter':
        return { kind: 'scatter', x: name(spec.x), y: name(spec.y) };
    }
  };
  return JSON.stringify(
    {
      format: 'datacanvas-dashboard-spec',
      version: 1,
      note: 'DataCanvas-native description. It explains how to recreate these charts in another tool; it is not importable into Power BI or Metabase.',
      dataset: datasetName,
      columns: columns.map((c) => ({ name: c.displayName, type: c.type, role: c.role })),
      dateReadings: Object.fromEntries(
        Object.entries(readings).map(([id, r]) => [name(id) ?? id, `${r.order} (${r.calendar})`]),
      ),
      kpis: rec.kpis.map(describe),
      charts: rec.charts.map(describe),
    },
    null,
    2,
  );
}
