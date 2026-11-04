/// <reference lib="webworker" />
import { LIMITS, ParseError, type ColumnProfile, type RawTable } from '../core/types';
import { buildDisplayMap, decisionsSchema, displayCell, summarizeChanges } from '../normalize/layer';
import { suggestNormalizations } from '../normalize/suggest';
import { parseFile } from '../parse/parseFile';
import { inferColumns } from '../profile/inferColumns';
import type { WorkerRequest, WorkerResponse } from './protocol';

// The full dataset lives here, never on the main thread.
interface Loaded {
  table: RawTable;
  columns: ColumnProfile[];
}
const datasets = new Map<string, Loaded>();
let currentId: string | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function handleParse(msg: Extract<WorkerRequest, { type: 'parse' }>): void {
  const table = parseFile(msg.buffer, msg.fileName);
  const id = `ds_${msg.requestId}`;
  const columns = inferColumns(table.headers, table.originalHeaders, table.rows);
  datasets.clear(); // one dataset at a time keeps memory bounded
  datasets.set(id, { table, columns });
  currentId = id;
  post({
    type: 'parsed',
    requestId: msg.requestId,
    summary: {
      id,
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
  const loaded = currentId ? datasets.get(currentId) : undefined;
  if (!loaded) {
    post({ type: 'error', requestId: msg.requestId, code: 'invalid-request', message: 'No dataset loaded.' });
    return;
  }
  const parsed = decisionsSchema.safeParse(msg.decisions);
  const knownIds = new Set(loaded.columns.map((c) => c.id));
  if (!parsed.success || parsed.data.some((d) => !knownIds.has(d.columnId))) {
    post({ type: 'error', requestId: msg.requestId, code: 'invalid-request', message: 'Invalid decisions.' });
    return;
  }
  const map = buildDisplayMap(parsed.data);
  const ids = loaded.columns.map((c) => c.id);
  const preview = loaded.table.rows
    .slice(0, LIMITS.previewRows)
    .map((row) => row.map((cell, j) => displayCell(ids[j] ?? '', cell, map)));
  post({ type: 'normalized', requestId: msg.requestId, preview, changes: summarizeChanges(loaded.table.rows, ids, map) });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'parse') handleParse(msg);
    else if (msg.type === 'normalize') handleNormalize(msg);
  } catch (error) {
    if (error instanceof ParseError) {
      post({ type: 'error', requestId: msg.requestId, code: error.code, message: error.message });
    } else {
      post({ type: 'error', requestId: msg.requestId, code: 'unknown', message: 'Unexpected error.' });
    }
  }
};
