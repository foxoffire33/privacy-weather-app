import { create } from 'zustand';

import { fetchAirQuality, fetchForecast, fetchMarine } from './api/remote';
import { classify } from './core/appError';
import { afterGesture } from './core/gesture';
import { without } from './core/guards';
import { persistMap, restore } from './core/recordSync';
import { FACTORY_VERSION } from './factories/weather';
import { begin, isFresh, isLoading, queryAt, setQuery, settleError, succeed } from './factory/queryState';

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

const drops = new Map<string, number>();
let cleared = 0;
const epochOf = (cityId: string) => `${String(cleared)}:${String(drops.get(cityId) ?? 0)}`;

export const useForecastStore = create<ForecastState>()((set, get) => ({
      forecasts: {},
      queries: {},
      refresh: async (city, { pastDays = 1, maxAgeMs } = {}) => {
        const q = queryAt(get().queries, city.id);
        if (isLoading(q)) { return null; }
        if (isFresh(q, maxAgeMs) && get().forecasts[city.id] !== undefined) { return null; }
        set((s) => ({ queries: setQuery(s.queries, city.id, begin(q)) }));
        const epoch = epochOf(city.id);
        try {
          const [data, air, marine] = await Promise.all([
            fetchForecast(city, pastDays, maxAgeMs),
            fetchAirQuality(city, maxAgeMs).catch(() => null),
            fetchMarine(city, maxAgeMs).catch(() => null),
          ]);
          const entry: ForecastEntry = { data, air, marine, pastDays, fetchedAt: Date.now(), version: FACTORY_VERSION };
          await afterGesture();
          if (epochOf(city.id) !== epoch) { return null; }
          set((s) => ({
            forecasts: { ...s.forecasts, [city.id]: entry },
            queries: setQuery(s.queries, city.id, succeed()),
          }));
          return entry;
        } catch (error) {
          if (epochOf(city.id) !== epoch) { return null; }
          const appError = classify(error, city.id);
          set((s) => ({ queries: setQuery(s.queries, city.id, settleError(queryAt(s.queries, city.id), appError)) }));
          return null;
        }
      },
      drop: (cityId) => {
        drops.set(cityId, (drops.get(cityId) ?? 0) + 1);
        set((s) => ({ forecasts: without(s.forecasts, [cityId]), queries: without(s.queries, [cityId]) }));
      },
      clear: () => {
        cleared += 1;
        set({ forecasts: {}, queries: {} });
      },
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

