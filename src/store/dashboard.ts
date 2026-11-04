import { create } from 'zustand';
import type { ChartOverride } from '../dashboard/overrides';
import type { ChartResult, ChartSpec, Filter } from '../dashboard/types';
import type { DateCandidate } from '../profile/dates';
import { aggregateInWorker, setDateChoiceInWorker, WorkerError } from '../worker/client';

// Light UI state plus the small aggregated results. Raw rows never leave the worker.
interface DashboardState {
  filters: Filter[];
  dateChoices: Record<string, DateCandidate>;
  overrides: Record<string, ChartOverride>;
  hidden: string[];
  results: Record<string, ChartResult>;
  /** KPI values with no filters applied, so the strip can show "of 12,700" while a filter is on. */
  baseline: Record<string, ChartResult>;
  loading: boolean;
  failed: boolean;
  toggleFilter: (columnId: string, value: string) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;
  setOverride: (chartId: string, patch: ChartOverride) => void;
  resetOverride: (chartId: string) => void;
  hideChart: (chartId: string) => void;
  showAllCharts: () => void;
  chooseDate: (columnId: string, candidate: DateCandidate) => Promise<void>;
  refresh: (specs: ChartSpec[], kpis: ChartSpec[]) => Promise<void>;
  reset: () => void;
}

const EMPTY = { filters: [], dateChoices: {}, overrides: {}, hidden: [], results: {}, baseline: {}, loading: false, failed: false };

export const useDashboard = create<DashboardState>((set, get) => ({
  ...EMPTY,
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
  setOverride: (chartId, patch) => set({ overrides: { ...get().overrides, [chartId]: { ...get().overrides[chartId], ...patch } } }),
  resetOverride: (chartId) => {
    const { [chartId]: _removed, ...rest } = get().overrides;
    void _removed;
    set({ overrides: rest });
  },
  hideChart: (chartId) => set({ hidden: [...get().hidden, chartId] }),
  showAllCharts: () => set({ hidden: [] }),
  chooseDate: async (columnId, candidate) => {
    try {
      await setDateChoiceInWorker(columnId, candidate);
      set({ dateChoices: { ...get().dateChoices, [columnId]: candidate } });
    } catch (error) {
      if (!(error instanceof WorkerError && error.superseded)) set({ failed: true });
    }
  },
  refresh: async (specs, kpis) => {
    set({ loading: true });
    try {
      const filters = get().filters;
      const results = await aggregateInWorker(specs, filters);
      // Only when a filter is active: the same KPIs without it (cheap, and cached in the worker).
      const baseline = filters.length > 0 ? await aggregateInWorker(kpis, []) : [];
      set({
        results: Object.fromEntries(results.map((r) => [r.id, r])),
        baseline: Object.fromEntries(baseline.map((r) => [r.id, r])),
        loading: false,
        failed: false,
      });
    } catch (error) {
      if (error instanceof WorkerError && error.superseded) return; // a newer request is in flight
      set({ loading: false, failed: true });
    }
  },
  reset: () => set({ ...EMPTY }),
}));
