import { z } from 'zod';

z.config({ jitless: true }); // no eval under our strict CSP (see normalize/schema.ts)

export const aggregationSchema = z.enum(['sum', 'avg', 'min', 'max', 'count', 'distinctCount']);

const id = z.string().min(1).max(100);

export const specSchema = z.discriminatedUnion('kind', [
  /** measure null + agg count = number of records */
  z.object({ id, kind: z.literal('kpi'), measure: id.nullable(), agg: aggregationSchema }),
  z.object({
    id,
    kind: z.literal('bar'),
    dimension: id,
    measure: id.nullable(),
    agg: aggregationSchema,
    topN: z.number().int().min(1).max(50),
  }),
  z.object({ id, kind: z.literal('line'), date: id, measure: id, agg: aggregationSchema }),
  z.object({ id, kind: z.literal('distribution'), dimension: id }),
  z.object({ id, kind: z.literal('scatter'), x: id, y: id }),
]);
export type ChartSpec = z.infer<typeof specSchema>;
export type KpiSpec = Extract<ChartSpec, { kind: 'kpi' }>;

export const specsSchema = z.array(specSchema).max(40);

/** Cross-filter: keep rows whose (display) value in `columnId` is one of `values`. */
export const filterSchema = z.object({ columnId: id, values: z.array(z.string().max(500)).min(1).max(200) });
export type Filter = z.infer<typeof filterSchema>;
export const filtersSchema = z.array(filterSchema).max(20);

export const dateCandidateSchema = z.object({
  order: z.enum(['ymd', 'dmy', 'mdy']),
  calendar: z.enum(['gregorian', 'hijri']),
});

export type Granularity = 'day' | 'month' | 'year';

export type ChartResult =
  | { id: string; kind: 'kpi'; value: number | null }
  | { id: string; kind: 'bar'; labels: string[]; values: number[]; omitted: number }
  | { id: string; kind: 'line'; labels: string[]; values: number[]; granularity: Granularity; calendar: 'gregorian' | 'hijri' }
  | { id: string; kind: 'distribution'; labels: string[]; values: number[]; other: number }
  | { id: string; kind: 'scatter'; points: [number, number][]; total: number };
