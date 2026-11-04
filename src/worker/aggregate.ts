import type { Aggregation } from '../core/types';
import type { ChartResult, ChartSpec, Filter, Granularity } from '../dashboard/types';
import type { ColumnStore } from './columnStore';

const MAX_SCATTER = 2000;
const DISTRIBUTION_SLICES = 8;

function buildMask(store: ColumnStore, filters: readonly Filter[], ignore: ReadonlySet<string>): Uint8Array | null {
  const active = filters.filter((f) => !ignore.has(f.columnId) && store.hasColumn(f.columnId));
  if (active.length === 0) return null;
  const mask = new Uint8Array(store.rowCount).fill(1);
  for (const f of active) {
    const cat = store.categorical(f.columnId);
    const allowed = new Uint8Array(cat.labels.length);
    for (const v of f.values) {
      const code = cat.index.get(v);
      if (code !== undefined) allowed[code] = 1;
    }
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const code = cat.codes[i]!;
      if (code < 0 || !allowed[code]) mask[i] = 0;
    }
  }
  return mask;
}

/** Accumulates sum/count/min/max per group so any simple aggregation can be read out. */
class Groups {
  sum: Float64Array;
  count: Float64Array;
  min: Float64Array;
  max: Float64Array;
  constructor(size: number) {
    this.sum = new Float64Array(size);
    this.count = new Float64Array(size);
    this.min = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
    this.max = new Float64Array(size).fill(Number.NEGATIVE_INFINITY);
  }
  add(g: number, v: number): void {
    this.sum[g]! += v;
    this.count[g]!++;
    if (v < this.min[g]!) this.min[g] = v;
    if (v > this.max[g]!) this.max[g] = v;
  }
  /** null when the group has no valid values */
  read(g: number, agg: Aggregation): number | null {
    const n = this.count[g]!;
    if (n === 0) return null;
    switch (agg) {
      case 'sum':
        return this.sum[g]!;
      case 'avg':
        return this.sum[g]! / n;
      case 'min':
        return this.min[g]!;
      case 'max':
        return this.max[g]!;
      default:
        return n; // count (distinctCount is not supported per group)
    }
  }
}

function runKpi(store: ColumnStore, spec: Extract<ChartSpec, { kind: 'kpi' }>, mask: Uint8Array | null): ChartResult {
  const n = store.rowCount;
  if (spec.measure === null) {
    let rows = 0;
    for (let i = 0; i < n; i++) if (!mask || mask[i]) rows++;
    return { id: spec.id, kind: 'kpi', value: rows };
  }
  const profile = store.profile(spec.measure);
  if (spec.agg === 'distinctCount' || profile.type !== 'number') {
    const seen = new Set<number>();
    let count = 0;
    const cat = store.categorical(spec.measure);
    for (let i = 0; i < n; i++) {
      if (mask && !mask[i]) continue;
      const code = cat.codes[i]!;
      if (code < 0) continue;
      seen.add(code);
      count++;
    }
    return { id: spec.id, kind: 'kpi', value: spec.agg === 'distinctCount' ? seen.size : count };
  }
  const values = store.numeric(spec.measure);
  const g = new Groups(1);
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    const v = values[i]!;
    if (!Number.isNaN(v)) g.add(0, v);
  }
  return { id: spec.id, kind: 'kpi', value: g.read(0, spec.agg) };
}

function runBar(store: ColumnStore, spec: Extract<ChartSpec, { kind: 'bar' }>, mask: Uint8Array | null): ChartResult {
  const cat = store.categorical(spec.dimension);
  const g = new Groups(cat.labels.length);
  const values = spec.measure ? store.numeric(spec.measure) : null;
  for (let i = 0; i < store.rowCount; i++) {
    if (mask && !mask[i]) continue;
    const code = cat.codes[i]!;
    if (code < 0) continue;
    if (values) {
      const v = values[i]!;
      if (!Number.isNaN(v)) g.add(code, v);
    } else {
      g.add(code, 1);
    }
  }
  const agg: Aggregation = spec.measure ? spec.agg : 'count';
  const rows: { label: string; value: number }[] = [];
  cat.labels.forEach((label, code) => {
    const value = g.read(code, agg === 'distinctCount' ? 'count' : agg);
    if (value !== null) rows.push({ label, value });
  });
  rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const top = rows.slice(0, spec.topN);
  return {
    id: spec.id,
    kind: 'bar',
    labels: top.map((r) => r.label),
    values: top.map((r) => r.value),
    omitted: Math.max(0, rows.length - top.length),
  };
}

function runDistribution(store: ColumnStore, spec: Extract<ChartSpec, { kind: 'distribution' }>, mask: Uint8Array | null): ChartResult {
  const cat = store.categorical(spec.dimension);
  const counts = new Float64Array(cat.labels.length);
  for (let i = 0; i < store.rowCount; i++) {
    if (mask && !mask[i]) continue;
    const code = cat.codes[i]!;
    if (code >= 0) counts[code]!++;
  }
  const rows = cat.labels
    .map((label, code) => ({ label, value: counts[code]! }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const top = rows.slice(0, DISTRIBUTION_SLICES);
  const other = rows.slice(DISTRIBUTION_SLICES).reduce((s, r) => s + r.value, 0);
  return { id: spec.id, kind: 'distribution', labels: top.map((r) => r.label), values: top.map((r) => r.value), other };
}

function approxDays(packed: number): number {
  const y = Math.floor(packed / 10000);
  const m = Math.floor((packed % 10000) / 100);
  const d = packed % 100;
  return y * 365 + m * 30 + d;
}

function pickGranularity(min: number, max: number): Granularity {
  const span = approxDays(max) - approxDays(min);
  if (span <= 62) return 'day';
  if (span <= 1100) return 'month';
  return 'year';
}

function periodKey(packed: number, granularity: Granularity): number {
  if (granularity === 'day') return packed;
  if (granularity === 'month') return Math.floor(packed / 100); // yyyymm
  return Math.floor(packed / 10000);
}

function periodLabel(key: number, granularity: Granularity): string {
  if (granularity === 'year') return String(key);
  if (granularity === 'month') return `${Math.floor(key / 100)}-${String(key % 100).padStart(2, '0')}`;
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  return `${y}-${String(m).padStart(2, '0')}-${String(key % 100).padStart(2, '0')}`;
}

function runLine(store: ColumnStore, spec: Extract<ChartSpec, { kind: 'line' }>, mask: Uint8Array | null): ChartResult {
  const reading = store.readingFor(spec.date);
  const dates = store.dates(spec.date);
  const calendar = reading?.calendar ?? 'gregorian';
  if (!dates) return { id: spec.id, kind: 'line', labels: [], values: [], granularity: 'month', calendar };

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < dates.length; i++) {
    if (mask && !mask[i]) continue;
    const d = dates[i]!;
    if (Number.isNaN(d)) continue;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  if (!Number.isFinite(min)) return { id: spec.id, kind: 'line', labels: [], values: [], granularity: 'month', calendar };

  const granularity = pickGranularity(min, max);
  const keyIndex = new Map<number, number>();
  const keys: number[] = [];
  const measure = store.numeric(spec.measure);
  const groupOf: number[] = new Array<number>(dates.length).fill(-1);
  for (let i = 0; i < dates.length; i++) {
    if (mask && !mask[i]) continue;
    const d = dates[i]!;
    if (Number.isNaN(d)) continue;
    const key = periodKey(d, granularity);
    let g = keyIndex.get(key);
    if (g === undefined) {
      g = keys.length;
      keys.push(key);
      keyIndex.set(key, g);
    }
    groupOf[i] = g;
  }
  const groups = new Groups(keys.length);
  for (let i = 0; i < dates.length; i++) {
    const g = groupOf[i]!;
    if (g < 0) continue;
    const v = measure[i]!;
    if (!Number.isNaN(v)) groups.add(g, v);
  }
  const agg: Aggregation = spec.agg === 'distinctCount' ? 'count' : spec.agg;
  const rows = keys
    .map((key, g) => ({ key, value: groups.read(g, agg) }))
    .filter((r): r is { key: number; value: number } => r.value !== null)
    .sort((a, b) => a.key - b.key);
  return {
    id: spec.id,
    kind: 'line',
    labels: rows.map((r) => periodLabel(r.key, granularity)),
    values: rows.map((r) => r.value),
    granularity,
    calendar,
  };
}

function runScatter(store: ColumnStore, spec: Extract<ChartSpec, { kind: 'scatter' }>, mask: Uint8Array | null): ChartResult {
  const xs = store.numeric(spec.x);
  const ys = store.numeric(spec.y);
  const all: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    if (mask && !mask[i]) continue;
    const x = xs[i]!;
    const y = ys[i]!;
    if (!Number.isNaN(x) && !Number.isNaN(y)) all.push([x, y]);
  }
  const stride = Math.max(1, Math.ceil(all.length / MAX_SCATTER));
  return { id: spec.id, kind: 'scatter', points: all.filter((_, i) => i % stride === 0), total: all.length };
}

const cache = new Map<string, ChartResult>();
let cacheVersion = '';

function ownColumns(spec: ChartSpec): Set<string> {
  // Bars and distributions keep showing every category of their own dimension while it is filtered.
  return spec.kind === 'bar' || spec.kind === 'distribution' ? new Set([spec.dimension]) : new Set();
}

export function runSpecs(store: ColumnStore, specs: readonly ChartSpec[], filters: readonly Filter[]): ChartResult[] {
  const version = `${store.uid}:${store.version}`;
  if (cacheVersion !== version) {
    cache.clear();
    cacheVersion = version;
  }
  return specs.map((spec) => {
    const ignore = ownColumns(spec);
    const relevant = filters.filter((f) => !ignore.has(f.columnId));
    const key = `${JSON.stringify(spec)}|${JSON.stringify(relevant)}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const mask = buildMask(store, filters, ignore);
    let result: ChartResult;
    switch (spec.kind) {
      case 'kpi':
        result = runKpi(store, spec, mask);
        break;
      case 'bar':
        result = runBar(store, spec, mask);
        break;
      case 'line':
        result = runLine(store, spec, mask);
        break;
      case 'distribution':
        result = runDistribution(store, spec, mask);
        break;
      case 'scatter':
        result = runScatter(store, spec, mask);
        break;
    }
    if (cache.size > 300) cache.clear();
    cache.set(key, result);
    return result;
  });
}
