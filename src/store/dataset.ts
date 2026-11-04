import { create } from 'zustand';
import type { DatasetSummary } from '../core/types';
import { parseInWorker, WorkerError } from '../worker/client';

// Only the lightweight summary lives here; the rows stay in the worker.
interface DatasetState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  summary: DatasetSummary | null;
  errorCode: string | null;
  load: (file: File) => Promise<void>;
  reset: () => void;
}

export const useDataset = create<DatasetState>((set) => ({
  status: 'idle',
  summary: null,
  errorCode: null,
  load: async (file) => {
    set({ status: 'loading', errorCode: null });
    try {
      const summary = await parseInWorker(file);
      set({ status: 'ready', summary });
    } catch (error) {
      const code = error instanceof WorkerError ? error.code : 'unknown';
      if (code === 'unknown' && error instanceof WorkerError && error.message.startsWith('Superseded')) return;
      set({ status: 'error', summary: null, errorCode: code });
    }
  },
  reset: () => set({ status: 'idle', summary: null, errorCode: null }),
}));
