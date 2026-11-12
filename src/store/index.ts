import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { createSettingsSlice } from './slices/settingsSlice';
import { createCitiesSlice } from './slices/citiesSlice';
import { createForecastSlice } from './slices/forecastSlice';
import { createHistorySlice } from './slices/historySlice';
import { createSearchSlice } from './slices/searchSlice';
import { createUiSlice } from './slices/uiSlice';
import type { StoreState } from './types';

type Persisted = Pick<StoreState, 'settings' | 'cities' | 'onboarded' | 'forecasts' | 'history' | 'normals' | 'thisDay' | 'days'>;

// One bound store composed from slices, persisted to IndexedDB.
// Views read it only through useShallow selectors.
export const useWeatherStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createCitiesSlice(...a),
      ...createForecastSlice(...a),
      ...createHistorySlice(...a),
      ...createSearchSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      name: 'open-weather-log',
      version: 2,
      // v2 changed the forecast shape; cached forecasts are dropped and refetched, history is kept.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Persisted>;
        return (version < 2 ? { ...p, forecasts: {} } : p) as Persisted;
      },
      storage: idbStorage<Persisted>(),
      partialize: (s): Persisted => ({
        settings: s.settings,
        cities: s.cities,
        onboarded: s.onboarded,
        forecasts: s.forecasts,
        history: s.history,
        normals: s.normals,
        thisDay: s.thisDay,
        days: s.days, // full past days, kept offline once opened
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Persisted>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
      },
      onRehydrateStorage: () => () => {
        useWeatherStore.getState().setHydrated();
      },
    },
  ),
);

export type { StoreState };
