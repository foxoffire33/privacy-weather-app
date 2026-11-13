import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { errorMessage } from './core/errors';
import { idbStorage } from './core/persistStorage';
import { begin, fail, isLoading, queryAt, setQuery, succeed } from './factory/queryState';
import { fetchArchive } from './api/openMeteo';
import type { ArchiveYear } from './types';
import type { AlmanacState } from './storeTypes';

export type { AlmanacState } from './storeTypes';

const BACK = [1, 10, 30] as const;
const FIRST_YEAR = 1940;

export const useAlmanacStore = create<AlmanacState>()(
  persist(
    (set, get) => ({
      normals: {},
      thisDay: {},
      queries: {},
      ensureNormals: async (city) => {
        const key = `normals:${city.id}`;
        if (get().normals[city.id] !== undefined || isLoading(get().queries[key])) return;
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        try {
          const r = await fetchArchive(city, '1991-01-01', '2020-12-31', ['temperature_2m_max']);
          const totals: Record<string, [number, number]> = {};
          r.time.forEach((day, i) => {
            const value = r.temperature_2m_max[i];
            if (value == null) return;
            const md = day.slice(5);
            totals[md] = totals[md] ?? [0, 0];
            totals[md][0] += value;
            totals[md][1] += 1;
          });
          const means: Record<string, number> = {};
          for (const md in totals) means[md] = +(totals[md][0] / totals[md][1]).toFixed(2);
          set((s) => ({ normals: { ...s.normals, [city.id]: means }, queries: setQuery(s.queries, key, succeed()) }));
        } catch (e) {
          set((s) => ({ queries: setQuery(s.queries, key, fail(queryAt(s.queries, key), errorMessage(e))) }));
        }
      },
      ensureThisDay: async (city, date) => {
        const key = `${city.id}:${date.slice(5)}`;
        if (get().thisDay[key] !== undefined || isLoading(get().queries[key])) return;
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        const thisYear = +date.slice(0, 4);
        const years = [...BACK.map((n) => thisYear - n), FIRST_YEAR];
        const rows: ArchiveYear[] = await Promise.all(years.map(async (year) => {
          const day = `${year}${date.slice(4)}`;
          try {
            const r = await fetchArchive(city, day, day);
            return { year, hi: r.temperature_2m_max[0] ?? undefined, lo: r.temperature_2m_min[0] ?? undefined, mm: r.precipitation_sum[0] ?? undefined };
          } catch {
            return { year, error: true };
          }
        }));
        set((s) => ({ thisDay: { ...s.thisDay, [key]: rows }, queries: setQuery(s.queries, key, succeed()) }));
      },
      clear: () => { set({ normals: {}, thisDay: {}, queries: {} }); },
    }),
    {
      name: 'wl2-almanac',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ normals: s.normals, thisDay: s.thisDay }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<AlmanacState>), queries: {} }),
    },
  ),
);
