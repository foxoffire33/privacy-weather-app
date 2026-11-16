import { create } from 'zustand';

import type { DiagnosticsState } from './storeTypes';

const KEEP = 200;

export const useDiagnosticsStore = create<DiagnosticsState>()((set) => ({
  entries: [],
  add: (entry) => { set((s) => ({ entries: [...s.entries.slice(-(KEEP - 1)), entry] })); },
  clear: () => { set({ entries: [] }); },
}));
