import { create } from 'zustand';

import type { Route } from '../types';

export interface UiState {
  route: Route;
  stack: Route[];
  pageIndex: number;
  expandedDay: Record<string, string | null>;
  chartMetric: string;
  historyRange: number;
  lookupDraft: string;
  setChartMetric: (m: string) => void;
  setHistoryRange: (d: number) => void;
  setLookupDraft: (date: string) => void;
  toggleDay: (cityId: string, date: string) => void;
  navigate: (route: Route) => void;
  back: () => void;
  goHome: (pageIndex?: number) => void;
  setPage: (i: number) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  route: { name: 'home' },
  stack: [],
  pageIndex: 0,
  expandedDay: {},
  chartMetric: 'temp',
  historyRange: 90,
  lookupDraft: '',
  setChartMetric: (chartMetric) => { set({ chartMetric }); },
  setHistoryRange: (historyRange) => { set({ historyRange }); },
  setLookupDraft: (lookupDraft) => { set({ lookupDraft }); },
  toggleDay: (cityId, date) => { set((s) => ({
    expandedDay: { ...s.expandedDay, [cityId]: s.expandedDay[cityId] === date ? null : date },
  })); },
  navigate: (route) => { set((s) => ({ stack: [...s.stack, s.route], route })); },
  back: () => { set((s) => (s.stack.length > 0
    ? { route: s.stack.at(-1), stack: s.stack.slice(0, -1) }
    : { route: { name: 'home' } })); },
  goHome: (pageIndex) => { set((s) => ({ route: { name: 'home' }, stack: [], pageIndex: pageIndex ?? s.pageIndex })); },
  setPage: (pageIndex) => { set({ pageIndex }); },
}));
