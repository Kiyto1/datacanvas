import type { DatasetSummary, ParseErrorCode, RawCell } from '../core/types';
import type { ChartResult, ChartSpec, Filter } from '../dashboard/types';
import type { ChangeLogEntry, NormalizationDecision } from '../normalize/types';
import type { DateCandidate } from '../profile/dates';

export type WorkerRequest =
  | { type: 'parse'; requestId: number; fileName: string; buffer: ArrayBuffer }
  | { type: 'normalize'; requestId: number; decisions: NormalizationDecision[] }
  | { type: 'aggregate'; requestId: number; specs: ChartSpec[]; filters: Filter[] }
  | { type: 'setDateChoice'; requestId: number; columnId: string; candidate: DateCandidate };

export type WorkerResponse =
  | { type: 'parsed'; requestId: number; summary: DatasetSummary }
  | { type: 'normalized'; requestId: number; preview: RawCell[][]; changes: ChangeLogEntry[] }
  | { type: 'aggregated'; requestId: number; results: ChartResult[] }
  | { type: 'dateChoiceSet'; requestId: number }
  | { type: 'error'; requestId: number; code: ParseErrorCode | 'invalid-request' | 'unknown'; message: string };
