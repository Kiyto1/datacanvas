import type { DatasetSummary, ParseErrorCode } from '../core/types';

export type WorkerRequest = { type: 'parse'; requestId: number; fileName: string; buffer: ArrayBuffer };

export type WorkerResponse =
  | { type: 'parsed'; requestId: number; summary: DatasetSummary }
  | { type: 'error'; requestId: number; code: ParseErrorCode | 'unknown'; message: string };
