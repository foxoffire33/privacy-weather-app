import { create } from 'zustand';

import { fetchAirQuality, fetchForecast, fetchMarine } from './api/remote';
import { errorMessage } from './core/errors';
import { afterGesture } from './core/gesture';
import { without } from './core/guards';
import { persistMap, restore } from './core/recordSync';
import { FACTORY_VERSION } from './factories/weather';
import { begin, fail, isFresh, isLoading, queryAt, setQuery, succeed } from './factory/queryState';

import type { QueryMap } from './core/types';
import type { ForecastState } from './storeTypes';
import type { ForecastEntry } from './types';

function loadedQueries(forecasts: ForecastState['forecasts']): QueryMap {
  const queries: QueryMap = {};
  for (const [cityId, entry] of Object.entries(forecasts)) {
    if (entry !== undefined) { queries[cityId] = { status: 'success', error: null, lastLoadedAt: entry.fetchedAt }; }
  }
  return queries;
}

export const useForecastStore = create<ForecastState>()((set, get) => ({
      forecasts: {},
      queries: {},
      refresh: async (city, { pastDays = 1, maxAgeMs } = {}) => {
        const q = queryAt(get().queries, city.id);
        if (isLoading(q)) { return null; }
        if (isFresh(q, maxAgeMs) && get().forecasts[city.id] !== undefined) { return null; }
        set((s) => ({ queries: setQuery(s.queries, city.id, begin(q)) }));
        try {
          const [data, air, marine] = await Promise.all([
            fetchForecast(city, pastDays, maxAgeMs),
            fetchAirQuality(city, maxAgeMs).catch(() => null),
            fetchMarine(city, maxAgeMs).catch(() => null),
          ]);
          const entry: ForecastEntry = { data, air, marine, pastDays, fetchedAt: Date.now(), version: FACTORY_VERSION };
          await afterGesture();
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
    }));

export const FORECAST_PREFIX = 'forecast:';

persistMap(useForecastStore, (s) => s.forecasts, FORECAST_PREFIX);

export function restoreForecasts(forecasts: ForecastState['forecasts']): void {
  restore(() => {
    useForecastStore.setState((s) => {
      const merged = { ...forecasts, ...s.forecasts };
      const queries = loadedQueries(merged);
      for (const [cityId, entry] of Object.entries(merged)) {
        if (entry?.version !== FACTORY_VERSION) { queries[cityId] = { status: 'success', error: null, lastLoadedAt: 0 }; }
      }
      return { forecasts: merged, queries: { ...queries, ...s.queries } };
    });
  });
}

