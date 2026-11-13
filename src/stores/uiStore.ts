import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UiState } from '../types';

const LEGACY_HINT_KEY = 'weather-log-hint-seen';

function legacyHintSeen(): boolean {
  try {
    return localStorage.getItem(LEGACY_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      route: { name: 'home' },
      stack: [],
      pageIndex: 0,
      expandedDay: {},
      chartMetric: 'temp',
      historyRange: 90,
      lookupDraft: '',
      logFilter: '',
      hiddenSeries: {},
      gestureHintSeen: legacyHintSeen(),
      fullscreenChart: null,
      setChartMetric: (chartMetric) => set({ chartMetric }),
      setHistoryRange: (historyRange) => set({ historyRange }),
      setLookupDraft: (lookupDraft) => set({ lookupDraft }),
      setLogFilter: (logFilter) => set({ logFilter }),
      toggleDay: (cityId, date) => set((s) => ({
        expandedDay: { ...s.expandedDay, [cityId]: s.expandedDay[cityId] === date ? null : date },
      })),
      toggleSeries: (scope, name) => set((s) => {
        const hidden = s.hiddenSeries[scope] ?? [];
        const next = hidden.includes(name) ? hidden.filter((n) => n !== name) : [...hidden, name];
        return { hiddenSeries: { ...s.hiddenSeries, [scope]: next } };
      }),
      dismissGestureHint: () => set({ gestureHintSeen: true }),
      openChart: (fullscreenChart) => set({ fullscreenChart }),
      closeChart: () => set({ fullscreenChart: null }),
      navigate: (route) => set((s) => ({ stack: [...s.stack, s.route], route })),
      back: () => set((s) => (s.stack.length > 0
        ? { route: s.stack.at(-1), stack: s.stack.slice(0, -1) }
        : { route: { name: 'home' } })),
      goHome: (pageIndex) => set((s) => ({ route: { name: 'home' }, stack: [], pageIndex: pageIndex ?? s.pageIndex })),
      setPage: (pageIndex) => set({ pageIndex }),
    }),
    {
      name: 'wl2-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ gestureHintSeen: s.gestureHintSeen }),
    },
  ),
);
