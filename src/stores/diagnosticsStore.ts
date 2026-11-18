import { create } from 'zustand';

import type { DiagnosticMetrics, DiagnosticsState } from './storeTypes';

const KEEP = 200;
const ZERO: DiagnosticMetrics = { loads: 0, cacheHits: 0, recordFlushes: 0, recordFlushFailures: 0, kvFlushes: 0, kvFlushFailures: 0, hydrationFailures: 0 };

export const useDiagnosticsStore = create<DiagnosticsState>()((set) => ({
  entries: [],
  metrics: ZERO,
  add: (entry) => { set((s) => ({ entries: [...s.entries.slice(-(KEEP - 1)), entry] })); },
  bump: (key) => { set((s) => ({ metrics: { ...s.metrics, [key]: s.metrics[key] + 1 } })); },
  addCacheCounts: (loads, cacheHits) => { set((s) => ({ metrics: { ...s.metrics, loads: s.metrics.loads + loads, cacheHits: s.metrics.cacheHits + cacheHits } })); },
  clear: () => { set({ entries: [], metrics: ZERO }); },
}));
