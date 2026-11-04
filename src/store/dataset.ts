import { create } from 'zustand';
import type { DatasetSummary } from '../core/types';
import type { ChangeLogEntry, NormalizationDecision } from '../normalize/types';
import { normalizeInWorker, parseInWorker, WorkerError } from '../worker/client';
import { useDashboard } from './dashboard';

// Only the lightweight summary lives here; the rows stay in the worker.
interface DatasetState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  summary: DatasetSummary | null;
  /** Preview rows with approved merges applied (originals are untouched in the worker). */
  preview: DatasetSummary['preview'];
  applied: NormalizationDecision[];
  changes: ChangeLogEntry[];
  errorCode: string | null;
  load: (file: File) => Promise<void>;
  applyNormalization: (decisions: NormalizationDecision[]) => Promise<void>;
  reset: () => void;
}

export const useDataset = create<DatasetState>((set) => ({
  status: 'idle',
  summary: null,
  preview: [],
  applied: [],
  changes: [],
  errorCode: null,
  load: async (file) => {
    set({ status: 'loading', errorCode: null });
    try {
      const summary = await parseInWorker(file);
      useDashboard.getState().reset(); // filters, date choices and results belong to the previous file
      set({ status: 'ready', summary, preview: summary.preview, applied: [], changes: [] });
    } catch (error) {
      if (error instanceof WorkerError && error.superseded) return;
      const code = error instanceof WorkerError ? error.code : 'unknown';
      set({ status: 'error', summary: null, preview: [], applied: [], changes: [], errorCode: code });
    }
  },
  applyNormalization: async (decisions) => {
    try {
      const { preview, changes } = await normalizeInWorker(decisions);
      set({ preview, changes, applied: decisions });
    } catch (error) {
      if (error instanceof WorkerError && error.superseded) return;
      set({ errorCode: error instanceof WorkerError ? error.code : 'unknown' });
    }
  },
  reset: () => set({ status: 'idle', summary: null, preview: [], applied: [], changes: [], errorCode: null }),
}));
