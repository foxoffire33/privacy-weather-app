import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchAirQuality, fetchForecast, fetchMarine } from './api/openMeteo';
import { errorMessage } from './core/errors';
import { without } from './core/guards';
import { idbStorage } from './core/persistStorage';
import { begin, fail, isFresh, isLoading, queryAt, setQuery, succeed } from './factory/queryState';

import type { QueryMap } from './core/types';
import type { ForecastState } from './storeTypes';
import type { ForecastEntry } from './types';

export type { ForecastState } from './storeTypes';

function loadedQueries(forecasts: ForecastState['forecasts']): QueryMap {
  const queries: QueryMap = {};
  for (const [cityId, entry] of Object.entries(forecasts)) {
    if (entry !== undefined) { queries[cityId] = { status: 'success', error: null, lastLoadedAt: entry.fetchedAt }; }
  }
  return queries;
}

function markLoaded(state: ForecastState | undefined): void {
  if (state !== undefined) { useForecastStore.setState({ queries: loadedQueries(state.forecasts) }); }
}

export const useForecastStore = create<ForecastState>()(
  persist(
    (set, get) => ({
      forecasts: {},
      queries: {},
      refresh: async (city, { pastDays = 1, maxAgeMs } = {}) => {
        const q = queryAt(get().queries, city.id);
        if (isLoading(q)) { return null; }
        if (isFresh(q, maxAgeMs) && get().forecasts[city.id] !== undefined) { return null; }
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
        } catch (error) {
          set((s) => ({ queries: setQuery(s.queries, city.id, fail(queryAt(s.queries, city.id), errorMessage(error))) }));
          return null;
        }
      },
      drop: (cityId) => { set((s) => ({ forecasts: without(s.forecasts, [cityId]), queries: without(s.queries, [cityId]) })); },
      clear: () => { set({ forecasts: {}, queries: {} }); },
    }),
    {
      name: 'wl2-forecasts',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ forecasts: s.forecasts }),
      onRehydrateStorage: () => markLoaded,
    },
  ),
);
