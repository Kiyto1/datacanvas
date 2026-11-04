import type { ColumnProfile } from '../core/types';
import type { DateCandidate } from '../profile/dates';
import type { ChartSpec, KpiSpec } from './types';

/** The reading chosen for each date column: proven by the data, or picked by the user. */
export type DateReadings = Record<string, DateCandidate>;

export function resolveReadings(columns: ColumnProfile[], userChoices: DateReadings): DateReadings {
  const out: DateReadings = {};
  for (const c of columns) {
    if (c.type !== 'date') continue;
    const chosen = userChoices[c.id] ?? c.dateInference?.chosen ?? null;
    if (chosen) out[c.id] = chosen;
  }
  return out;
}

export interface Recommendation {
  kpis: KpiSpec[];
  charts: ChartSpec[];
}

const MIN_SCORE = 30;
const MAX_CHARTS = 8;
const MAX_KPIS = 4;

interface Scored {
  spec: ChartSpec;
  score: number;
}

/**
 * Deterministic, ranked chart suggestions from column types and roles.
 * Scoring (higher first, below MIN_SCORE dropped):
 *   line 90 | bar 80 | distribution 60 | second-measure bar 55 | scatter 40
 *   + 5 when the header matched the business dictionary (roleSource 'header')
 *   + 5 for a readable category count (3-12), -10 for 21+ categories, -30 x null rate
 * Numeric columns are only ever summed when their role is a plain measure (see ColumnProfile).
 */
export function recommend(columns: ColumnProfile[], readings: DateReadings): Recommendation {
  const measures = columns
    .filter((c) => c.type === 'number' && c.role === 'measure' && c.nullRate < 0.9)
    .sort((a, b) => Number(b.roleSource === 'header') - Number(a.roleSource === 'header'));
  const dims = columns.filter(
    (c) => c.type === 'string' && c.role === 'dimension' && c.distinctCount >= 2 && c.distinctCount <= 50 && c.nullRate <= 0.5,
  );
  const dateColumns = columns.filter((c) => c.type === 'date' && readings[c.id]);

  const kpis: KpiSpec[] = [{ id: 'kpi:records', kind: 'kpi', measure: null, agg: 'count' }];
  for (const m of measures.slice(0, MAX_KPIS - 1)) {
    kpis.push({ id: `kpi:${m.id}:${m.defaultAggregation}`, kind: 'kpi', measure: m.id, agg: m.defaultAggregation });
  }

  const scored: Scored[] = [];
  const headerBonus = (c: ColumnProfile) => (c.roleSource === 'header' ? 5 : 0);

  const dateColumn = dateColumns[0];
  if (dateColumn) {
    measures.slice(0, 2).forEach((m, i) => {
      scored.push({
        spec: { id: `line:${dateColumn.id}:${m.id}`, kind: 'line', date: dateColumn.id, measure: m.id, agg: m.defaultAggregation },
        score: 90 - i * 5 + headerBonus(m),
      });
    });
  }

  const primary = measures[0];
  const dimScores = dims
    .map((d) => {
      let score = 80 + headerBonus(d) - d.nullRate * 30;
      if (d.distinctCount >= 3 && d.distinctCount <= 12) score += 5;
      if (d.distinctCount > 20) score -= 10;
      return { dim: d, score };
    })
    .sort((a, b) => b.score - a.score);

  dimScores.slice(0, 3).forEach(({ dim, score }) => {
    scored.push({
      spec: {
        id: `bar:${dim.id}:${primary?.id ?? 'count'}`,
        kind: 'bar',
        dimension: dim.id,
        measure: primary?.id ?? null,
        agg: primary?.defaultAggregation ?? 'count',
        topN: 10,
      },
      score,
    });
  });

  const second = measures[1];
  const firstDim = dimScores[0]?.dim;
  if (second && firstDim) {
    scored.push({
      spec: {
        id: `bar:${firstDim.id}:${second.id}`,
        kind: 'bar',
        dimension: firstDim.id,
        measure: second.id,
        agg: second.defaultAggregation,
        topN: 10,
      },
      score: 55,
    });
  }

  dims
    .filter((d) => d.distinctCount >= 2 && d.distinctCount <= 8)
    .slice(0, 2)
    .forEach((d) => scored.push({ spec: { id: `dist:${d.id}`, kind: 'distribution', dimension: d.id }, score: 60 + headerBonus(d) }));

  const [mx, my] = measures;
  if (mx && my) {
    scored.push({ spec: { id: `scatter:${mx.id}:${my.id}`, kind: 'scatter', x: mx.id, y: my.id }, score: 40 });
  }

  const charts = scored
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CHARTS)
    .map((s) => s.spec);
  return { kpis, charts };
}
