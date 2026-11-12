import type { SliceCreator, UiSlice } from '../types';

// Navigation lives in the store: a route, a back stack and the home pager index.
// The pager always starts at 0 — the default city.
export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  hydrated: false,
  route: { name: 'home' },
  stack: [],
  pageIndex: 0,
  expandedDay: {},
  chartMetric: 'temp',
  historyRange: 90,

  setHydrated: () => set({ hydrated: true }),
  setChartMetric: (chartMetric) => set({ chartMetric }),
  setHistoryRange: (historyRange) => set({ historyRange }),
  toggleDay: (cityId, date) => set((s) => ({
    expandedDay: { ...s.expandedDay, [cityId]: s.expandedDay[cityId] === date ? null : date },
  })),
  navigate: (route) => set((s) => ({ stack: [...s.stack, s.route], route })),
  back: () => set((s) => (s.stack.length
    ? { route: s.stack[s.stack.length - 1], stack: s.stack.slice(0, -1) }
    : { route: { name: 'home' } })),
  goHome: (pageIndex) => set((s) => ({ route: { name: 'home' }, stack: [], pageIndex: pageIndex ?? s.pageIndex })),
  setPage: (pageIndex) => set({ pageIndex }),
});
