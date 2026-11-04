import type { Aggregation, ColumnProfile } from '../core/types';
import type { ChartSpec } from './types';

/** What a person can change on a suggested chart. Everything else stays as recommended. */
export interface ChartOverride {
  dimension?: string;
  /** null = count records */
  measure?: string | null;
  agg?: Aggregation;
  topN?: number;
}

export const TOP_N_CHOICES = [5, 10, 20] as const;

export function dimensionChoices(columns: ColumnProfile[]): ColumnProfile[] {
  return columns.filter((c) => c.type === 'string' && c.role !== 'identifier' && c.distinctCount >= 2 && c.distinctCount <= 200);
}

/** Identifiers are excluded on purpose: numeric does not mean summable. */
export function measureChoices(columns: ColumnProfile[]): ColumnProfile[] {
  return columns.filter((c) => c.type === 'number' && c.role === 'measure');
}

export function allowedAggregations(columns: ColumnProfile[], measure: string | null): Aggregation[] {
  if (measure === null) return ['count'];
  return columns.find((c) => c.id === measure)?.allowedAggregations.filter((a) => a !== 'distinctCount') ?? ['count'];
}

function validAgg(columns: ColumnProfile[], measure: string | null, wanted: Aggregation | undefined, fallback: Aggregation): Aggregation {
  const allowed = allowedAggregations(columns, measure);
  if (wanted && allowed.includes(wanted)) return wanted;
  if (measure === null) return 'count';
  const profile = columns.find((c) => c.id === measure);
  return profile && allowed.includes(profile.defaultAggregation) ? profile.defaultAggregation : (allowed[0] ?? fallback);
}

/**
 * Applies a person's changes to a recommended spec. A changed measure resets the calculation to one
 * that is allowed for it (a unit price can never be summed, an identifier can never be a measure).
 */
export function applyOverride(spec: ChartSpec, override: ChartOverride | undefined, columns: ColumnProfile[]): ChartSpec {
  if (!override) return spec;
  switch (spec.kind) {
    case 'bar': {
      const measure = override.measure !== undefined ? override.measure : spec.measure;
      const measureChanged = override.measure !== undefined && override.measure !== spec.measure;
      const agg = validAgg(columns, measure, measureChanged ? override.agg : (override.agg ?? spec.agg), spec.agg);
      return {
        ...spec,
        dimension: override.dimension ?? spec.dimension,
        measure,
        agg,
        topN: override.topN ?? spec.topN,
      };
    }
    case 'line': {
      const measure = override.measure ?? spec.measure;
      const measureChanged = measure !== spec.measure;
      return { ...spec, measure, agg: validAgg(columns, measure, measureChanged ? override.agg : (override.agg ?? spec.agg), spec.agg) };
    }
    case 'distribution':
      return { ...spec, dimension: override.dimension ?? spec.dimension };
    default:
      return spec;
  }
}
