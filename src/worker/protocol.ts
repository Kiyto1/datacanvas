import type { DatasetSummary, ParseErrorCode, RawCell } from '../core/types';
import type { ChangeLogEntry, NormalizationDecision } from '../normalize/types';

export type WorkerRequest =
  | { type: 'parse'; requestId: number; fileName: string; buffer: ArrayBuffer }
  | { type: 'normalize'; requestId: number; decisions: NormalizationDecision[] };

export type WorkerResponse =
  | { type: 'parsed'; requestId: number; summary: DatasetSummary }
  | { type: 'normalized'; requestId: number; preview: RawCell[][]; changes: ChangeLogEntry[] }
  | { type: 'error'; requestId: number; code: ParseErrorCode | 'invalid-request' | 'unknown'; message: string };
