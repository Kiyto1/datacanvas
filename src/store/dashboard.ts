import { create } from 'zustand';
import type { ChartResult, ChartSpec, Filter } from '../dashboard/types';
import type { DateCandidate } from '../profile/dates';
import { aggregateInWorker, setDateChoiceInWorker, WorkerError } from '../worker/client';

// Light UI state plus the small aggregated results. Raw rows never leave the worker.
interface DashboardState {
  filters: Filter[];
  dateChoices: Record<string, DateCandidate>;
  results: Record<string, ChartResult>;
  loading: boolean;
  failed: boolean;
  toggleFilter: (columnId: string, value: string) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;
  chooseDate: (columnId: string, candidate: DateCandidate) => Promise<void>;
  refresh: (specs: ChartSpec[]) => Promise<void>;
  reset: () => void;
}

export const useDashboard = create<DashboardState>((set, get) => ({
  filters: [],
  dateChoices: {},
  results: {},
  loading: false,
  failed: false,
  toggleFilter: (columnId, value) => {
    const current = get().filters;
    const existing = current.find((f) => f.columnId === columnId);
    if (!existing) return set({ filters: [...current, { columnId, values: [value] }] });
    const values = existing.values.includes(value) ? existing.values.filter((v) => v !== value) : [...existing.values, value];
    set({
      filters: values.length === 0 ? current.filter((f) => f.columnId !== columnId) : current.map((f) => (f.columnId === columnId ? { columnId, values } : f)),
    });
  },
  removeFilter: (columnId) => set({ filters: get().filters.filter((f) => f.columnId !== columnId) }),
  clearFilters: () => set({ filters: [] }),
  chooseDate: async (columnId, candidate) => {
    try {
      await setDateChoiceInWorker(columnId, candidate);
      set({ dateChoices: { ...get().dateChoices, [columnId]: candidate } });
    } catch (error) {
      if (!(error instanceof WorkerError && error.superseded)) set({ failed: true });
    }
  },
  refresh: async (specs) => {
    set({ loading: true });
    try {
      const results = await aggregateInWorker(specs, get().filters);
      set({ results: Object.fromEntries(results.map((r) => [r.id, r])), loading: false, failed: false });
    } catch (error) {
      if (error instanceof WorkerError && error.superseded) return; // a newer request is in flight
      set({ loading: false, failed: true });
    }
  },
  reset: () => set({ filters: [], dateChoices: {}, results: {}, loading: false, failed: false }),
}));
