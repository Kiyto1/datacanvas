/// <reference lib="webworker" />
import { LIMITS, ParseError } from '../core/types';
import { dateCandidateSchema, filtersSchema, specsSchema, type ChartSpec } from '../dashboard/types';
import { buildDisplayMap, decisionsSchema, displayCell, summarizeChanges } from '../normalize/layer';
import { suggestNormalizations } from '../normalize/suggest';
import { parseFile } from '../parse/parseFile';
import { inferColumns } from '../profile/inferColumns';
import { runSpecs } from './aggregate';
import { ColumnStore } from './columnStore';
import type { WorkerRequest, WorkerResponse } from './protocol';

// The full dataset lives here, never on the main thread.
let store: ColumnStore | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function invalid(requestId: number, message: string): void {
  post({ type: 'error', requestId, code: 'invalid-request', message });
}

function handleParse(msg: Extract<WorkerRequest, { type: 'parse' }>): void {
  const table = parseFile(msg.buffer, msg.fileName);
  const columns = inferColumns(table.headers, table.originalHeaders, table.rows);
  store = new ColumnStore(table, columns); // replaces any previous dataset: memory stays bounded
  post({
    type: 'parsed',
    requestId: msg.requestId,
    summary: {
      id: `ds_${store.uid}`,
      name: msg.fileName,
      rowCount: table.rows.length,
      columnCount: table.headers.length,
      headers: table.headers,
      originalHeaders: table.originalHeaders,
      columns,
      suggestions: suggestNormalizations(columns, table.rows),
      preview: table.rows.slice(0, LIMITS.previewRows),
      encoding: table.encoding,
      ...(table.sheetName !== undefined ? { sheetName: table.sheetName } : {}),
    },
  });
}

function handleNormalize(msg: Extract<WorkerRequest, { type: 'normalize' }>): void {
  if (!store) return invalid(msg.requestId, 'No dataset loaded.');
  const parsed = decisionsSchema.safeParse(msg.decisions);
  if (!parsed.success || parsed.data.some((d) => !store!.hasColumn(d.columnId))) {
    return invalid(msg.requestId, 'Invalid decisions.');
  }
  const map = buildDisplayMap(parsed.data);
  store.setDecisions(map); // dashboards now read approved display values
  const ids = store.columns.map((c) => c.id);
  const preview = store.table.rows
    .slice(0, LIMITS.previewRows)
    .map((row) => row.map((cell, j) => displayCell(ids[j] ?? '', cell, map)));
  post({ type: 'normalized', requestId: msg.requestId, preview, changes: summarizeChanges(store.table.rows, ids, map) });
}

function specColumns(spec: ChartSpec): string[] {
  switch (spec.kind) {
    case 'kpi':
      return spec.measure ? [spec.measure] : [];
    case 'bar':
      return spec.measure ? [spec.dimension, spec.measure] : [spec.dimension];
    case 'line':
      return [spec.date, spec.measure];
    case 'distribution':
      return [spec.dimension];
    case 'scatter':
      return [spec.x, spec.y];
  }
}

function handleAggregate(msg: Extract<WorkerRequest, { type: 'aggregate' }>): void {
  if (!store) return invalid(msg.requestId, 'No dataset loaded.');
  const specs = specsSchema.safeParse(msg.specs);
  const filters = filtersSchema.safeParse(msg.filters);
  if (!specs.success || !filters.success) return invalid(msg.requestId, 'Invalid request.');
  const known = (id: string) => store!.hasColumn(id);
  if (specs.data.some((s) => !specColumns(s).every(known)) || !filters.data.every((f) => known(f.columnId))) {
    return invalid(msg.requestId, 'Unknown column.');
  }
  post({ type: 'aggregated', requestId: msg.requestId, results: runSpecs(store, specs.data, filters.data) });
}

function handleDateChoice(msg: Extract<WorkerRequest, { type: 'setDateChoice' }>): void {
  if (!store) return invalid(msg.requestId, 'No dataset loaded.');
  const candidate = dateCandidateSchema.safeParse(msg.candidate);
  if (!candidate.success || !store.hasColumn(msg.columnId) || store.profile(msg.columnId).type !== 'date') {
    return invalid(msg.requestId, 'Invalid date choice.');
  }
  store.setReading(msg.columnId, candidate.data);
  post({ type: 'dateChoiceSet', requestId: msg.requestId });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case 'parse':
        return handleParse(msg);
      case 'normalize':
        return handleNormalize(msg);
      case 'aggregate':
        return handleAggregate(msg);
      case 'setDateChoice':
        return handleDateChoice(msg);
    }
  } catch (error) {
    if (error instanceof ParseError) {
      post({ type: 'error', requestId: msg.requestId, code: error.code, message: error.message });
    } else {
      post({ type: 'error', requestId: msg.requestId, code: 'unknown', message: 'Unexpected error.' });
    }
  }
};
