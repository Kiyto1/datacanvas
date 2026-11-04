import type { DatasetSummary, ParseErrorCode } from '../core/types';
import type { WorkerRequest, WorkerResponse } from './protocol';

export class WorkerError extends Error {
  readonly code: ParseErrorCode | 'unknown';
  constructor(code: ParseErrorCode | 'unknown', message: string) {
    super(message);
    this.name = 'WorkerError';
    this.code = code;
  }
}

let worker: Worker | null = null;
let nextRequestId = 0;
let latestRequestId = 0;
const pending = new Map<number, { resolve: (s: DatasetSummary) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./dataWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    const entry = pending.get(msg.requestId);
    if (!entry) return;
    pending.delete(msg.requestId);
    // Stale responses (an older request finishing after a newer one started) are ignored.
    if (msg.requestId !== latestRequestId) {
      entry.reject(new WorkerError('unknown', 'Superseded by a newer request.'));
      return;
    }
    if (msg.type === 'parsed') entry.resolve(msg.summary);
    else entry.reject(new WorkerError(msg.code, msg.message));
  };
  worker.onerror = () => {
    for (const entry of pending.values()) entry.reject(new WorkerError('unknown', 'Worker failed.'));
    pending.clear();
    worker = null;
  };
  return worker;
}

export async function parseInWorker(file: File): Promise<DatasetSummary> {
  const buffer = await file.arrayBuffer();
  const requestId = ++nextRequestId;
  latestRequestId = requestId;
  const request: WorkerRequest = { type: 'parse', requestId, fileName: file.name, buffer };
  return new Promise<DatasetSummary>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    getWorker().postMessage(request, [buffer]);
  });
}
