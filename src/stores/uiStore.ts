import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UiState } from '../types';

const LOG_PAGE = 50;
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
      navDirection: 'forward',
      pageIndex: 0,
      expandedDay: {},
      chartMetric: 'temp',
      historyRange: 90,
      lookupDraft: '',
      logFilter: '',
      logLimit: LOG_PAGE,
      hiddenSeries: {},
      gestureHintSeen: legacyHintSeen(),
      fullscreenChart: null,
      setChartMetric: (chartMetric) => set({ chartMetric }),
      setHistoryRange: (historyRange) => set({ historyRange }),
      setLookupDraft: (lookupDraft) => set({ lookupDraft }),
      setLogFilter: (logFilter) => set({ logFilter, logLimit: LOG_PAGE }),
      showMoreLog: () => set((s) => ({ logLimit: s.logLimit + LOG_PAGE })),
      resetLogLimit: () => set({ logLimit: LOG_PAGE }),
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
      navigate: (route) => set((s) => ({ stack: [...s.stack, s.route], route, navDirection: 'forward' })),
      back: () => set((s) => ({ route: s.stack.at(-1) ?? { name: 'home' }, stack: s.stack.slice(0, -1), navDirection: 'back' })),
      goHome: (pageIndex) => set((s) => ({ route: { name: 'home' }, stack: [], pageIndex: pageIndex ?? s.pageIndex, navDirection: 'back' })),
      setPage: (pageIndex) => set({ pageIndex }),
    }),
    {
      name: 'wl2-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ gestureHintSeen: s.gestureHintSeen }),
    },
  ),
);
