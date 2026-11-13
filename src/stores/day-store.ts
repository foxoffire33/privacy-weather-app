import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { errorMessage } from './core/errors';
import { idbStorage } from './core/persist-storage';
import type { QueryMap } from './core/types';
import { begin, fail, isLoading, queryAt, setQuery, succeed } from './factory/query-state';
import { fetchAirDay, fetchDay } from './api/open-meteo';
import { dayKey } from './entities/schema';
import { daysBetween, todayISO } from './core/time';
import type { City, DayData } from './types';
import type { DayState } from './store-types';

export type { DayState } from './store-types';

export const useDayStore = create<DayState>()(
  persist(
    (set, get) => ({
      days: {},
      queries: {},
      load: async (city, date) => {
        const key = dayKey(city.id, date);
        if (get().days[key] !== undefined || isLoading(get().queries[key])) return null;
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        try {
          const recent = daysBetween(date, todayISO()) <= 90;
          const [day, air] = await Promise.all([
            fetchDay(city, date, recent),
            fetchAirDay(city, date).catch(() => null),
          ]);
          const full: DayData = { ...day, air };
          set((s) => ({ days: { ...s.days, [key]: full }, queries: setQuery(s.queries, key, succeed()) }));
          return full;
        } catch (e) {
          set((s) => ({ queries: setQuery(s.queries, key, fail(queryAt(s.queries, key), errorMessage(e))) }));
          return null;
        }
      },
      clear: () => { set({ days: {}, queries: {} }); },
    }),
    {
      name: 'wl2-days',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ days: s.days }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<DayState>), queries: {} }),
    },
  ),
);
