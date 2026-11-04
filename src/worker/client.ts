import type { DatasetSummary, RawCell } from '../core/types';
import type { ChartResult, ChartSpec, Filter } from '../dashboard/types';
import type { ChangeLogEntry, NormalizationDecision } from '../normalize/types';
import type { DateCandidate } from '../profile/dates';
import type { WorkerRequest, WorkerResponse } from './protocol';

type ErrorCode = Extract<WorkerResponse, { type: 'error' }>['code'];

export class WorkerError extends Error {
  readonly code: ErrorCode;
  readonly superseded: boolean;
  constructor(code: ErrorCode, message: string, superseded = false) {
    super(message);
    this.name = 'WorkerError';
    this.code = code;
    this.superseded = superseded;
  }
}

type Kind = WorkerRequest['type'];
interface Pending {
  kind: Kind;
  resolve: (r: WorkerResponse) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextRequestId = 0;
const latest: Record<Kind, number> = { parse: 0, normalize: 0, aggregate: 0, setDateChoice: 0 };
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./dataWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    const entry = pending.get(msg.requestId);
    if (!entry) return;
    pending.delete(msg.requestId);
    // A newer request of the same kind exists: this answer is stale and must not overwrite it.
    if (msg.requestId !== latest[entry.kind]) {
      entry.reject(new WorkerError('unknown', 'Superseded by a newer request.', true));
      return;
    }
    if (msg.type === 'error') entry.reject(new WorkerError(msg.code, msg.message));
    else entry.resolve(msg);
  };
  worker.onerror = () => {
    for (const entry of pending.values()) entry.reject(new WorkerError('unknown', 'Worker failed.'));
    pending.clear();
    worker = null;
  };
  return worker;
}

function send(kind: Kind, build: (requestId: number) => WorkerRequest, transfer: Transferable[] = []): Promise<WorkerResponse> {
  const requestId = ++nextRequestId;
  latest[kind] = requestId;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { kind, resolve, reject });
    getWorker().postMessage(build(requestId), transfer);
  });
}

export async function parseInWorker(file: File): Promise<DatasetSummary> {
  const buffer = await file.arrayBuffer();
  const res = await send('parse', (requestId) => ({ type: 'parse', requestId, fileName: file.name, buffer }), [buffer]);
  if (res.type !== 'parsed') throw new WorkerError('unknown', 'Unexpected response.');
  return res.summary;
}

export async function aggregateInWorker(specs: ChartSpec[], filters: Filter[]): Promise<ChartResult[]> {
  const res = await send('aggregate', (requestId) => ({ type: 'aggregate', requestId, specs, filters }));
  if (res.type !== 'aggregated') throw new WorkerError('unknown', 'Unexpected response.');
  return res.results;
}

export async function setDateChoiceInWorker(columnId: string, candidate: DateCandidate): Promise<void> {
  const res = await send('setDateChoice', (requestId) => ({ type: 'setDateChoice', requestId, columnId, candidate }));
  if (res.type !== 'dateChoiceSet') throw new WorkerError('unknown', 'Unexpected response.');
}

export async function normalizeInWorker(
  decisions: NormalizationDecision[],
): Promise<{ preview: RawCell[][]; changes: ChangeLogEntry[] }> {
  const res = await send('normalize', (requestId) => ({ type: 'normalize', requestId, decisions }));
  if (res.type !== 'normalized') throw new WorkerError('unknown', 'Unexpected response.');
  return { preview: res.preview, changes: res.changes };
}
