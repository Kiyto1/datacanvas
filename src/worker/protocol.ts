import type { DatasetSummary, ParseErrorCode, RawCell } from '../core/types';
import type { ChartResult, ChartSpec, Filter } from '../dashboard/types';
import type { ExportRequest } from '../export/run';
import type { ChangeLogEntry, NormalizationDecision } from '../normalize/types';
import type { DateCandidate } from '../profile/dates';

export type WorkerRequest =
  | { type: 'parse'; requestId: number; fileName: string; buffer: ArrayBuffer }
  | { type: 'normalize'; requestId: number; decisions: NormalizationDecision[] }
  | { type: 'aggregate'; requestId: number; specs: ChartSpec[]; filters: Filter[] }
  | { type: 'setDateChoice'; requestId: number; columnId: string; candidate: DateCandidate }
  | { type: 'export'; requestId: number; request: ExportRequest };

export type WorkerResponse =
  | { type: 'parsed'; requestId: number; summary: DatasetSummary }
  | { type: 'normalized'; requestId: number; preview: RawCell[][]; changes: ChangeLogEntry[] }
  | { type: 'aggregated'; requestId: number; results: ChartResult[] }
  | { type: 'dateChoiceSet'; requestId: number }
  | { type: 'exported'; requestId: number; fileName: string; mime: string; bytes: Uint8Array }
  | { type: 'error'; requestId: number; code: ParseErrorCode | 'invalid-request' | 'unknown'; message: string };
