/// <reference lib="webworker" />
import { LIMITS, ParseError, type RawTable } from '../core/types';
import { parseFile } from '../parse/parseFile';
import type { WorkerRequest, WorkerResponse } from './protocol';

// The full dataset lives here, never on the main thread.
const datasets = new Map<string, RawTable>();

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type !== 'parse') return;
  try {
    const table = parseFile(msg.buffer, msg.fileName);
    const id = `ds_${msg.requestId}`;
    datasets.clear(); // one dataset at a time keeps memory bounded
    datasets.set(id, table);
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
        preview: table.rows.slice(0, LIMITS.previewRows),
        encoding: table.encoding,
        ...(table.sheetName !== undefined ? { sheetName: table.sheetName } : {}),
      },
    });
  } catch (error) {
    if (error instanceof ParseError) {
      post({ type: 'error', requestId: msg.requestId, code: error.code, message: error.message });
    } else {
      post({ type: 'error', requestId: msg.requestId, code: 'unknown', message: 'Unexpected error.' });
    }
  }
};
