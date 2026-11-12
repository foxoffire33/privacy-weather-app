import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { errorMessage } from '../core/errors';
import { idbStorage } from '../core/persist-storage';
import type { QueryMap } from '../core/types';
import { begin, fail, isFresh, isLoading, queryAt, setQuery, succeed } from '../factory/query-state';
import { fetchAirQuality, fetchForecast, fetchMarine } from '../api/open-meteo';
import type { City, ForecastEntry } from '../types';
import type { ForecastState } from './types';

export type { ForecastState } from './types';

export const useForecastStore = create<ForecastState>()(
  persist(
    (set, get) => ({
      forecasts: {},
      queries: {},
      refresh: async (city, { pastDays = 1, maxAgeMs } = {}) => {
        const q = queryAt(get().queries, city.id);
        if (isLoading(q)) return null;
        if (isFresh(q, maxAgeMs) && get().forecasts[city.id] !== undefined) return null;
        set((s) => ({ queries: setQuery(s.queries, city.id, begin(q)) }));
        try {
          const [data, air, marine] = await Promise.all([
            fetchForecast(city, pastDays),
            fetchAirQuality(city).catch(() => null),
            fetchMarine(city).catch(() => null),
          ]);
          const entry: ForecastEntry = { data, air, marine, pastDays, fetchedAt: Date.now() };
          set((s) => ({
            forecasts: { ...s.forecasts, [city.id]: entry },
            queries: setQuery(s.queries, city.id, succeed()),
          }));
          return entry;
        } catch (e) {
          set((s) => ({ queries: setQuery(s.queries, city.id, fail(queryAt(s.queries, city.id), errorMessage(e))) }));
          return null;
        }
      },
      drop: (cityId) => set((s) => {
        const forecasts = { ...s.forecasts };
        delete forecasts[cityId];
        const queries = { ...s.queries };
        delete queries[cityId];
        return { forecasts, queries };
      }),
      clear: () => { set({ forecasts: {}, queries: {} }); },
    }),
    {
      name: 'wl2-forecasts',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ forecasts: s.forecasts }),
      merge: (persisted, current) => {
        const forecasts = (persisted as Partial<ForecastState> | null)?.forecasts ?? {};
        const queries: QueryMap = {};
        for (const [cityId, entry] of Object.entries(forecasts)) {
          queries[cityId] = { status: 'success', error: null, lastLoadedAt: entry.fetchedAt };
        }
        return { ...current, forecasts, queries };
      },
    },
  ),
);
