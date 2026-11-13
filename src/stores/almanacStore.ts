import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchArchive } from './api/openMeteo';
import { errorMessage } from './core/errors';
import { idbStorage } from './core/persistStorage';
import { begin, fail, isLoading, queryAt, setQuery, succeed } from './factory/queryState';

import type { AlmanacState } from './storeTypes';
import type { ArchiveYear } from './types';

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
        if (get().normals[city.id] !== undefined || isLoading(get().queries[key])) { return; }
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        try {
          const r = await fetchArchive(city, '1991-01-01', '2020-12-31', ['temperature_2m_max']);
          const totals = new Map<string, { sum: number; n: number }>();
          for (const [i, day] of r.time.entries()) {
            const value = r.temperature_2m_max?.[i] ?? null;
            if (value === null) { continue; }
            const md = day.slice(5);
            const total = totals.get(md) ?? { sum: 0, n: 0 };
            totals.set(md, { sum: total.sum + value, n: total.n + 1 });
          }
          const means: Record<string, number> = {};
          for (const [md, total] of totals) { means[md] = +(total.sum / total.n).toFixed(2); }
          set((s) => ({ normals: { ...s.normals, [city.id]: means }, queries: setQuery(s.queries, key, succeed()) }));
        } catch (error) {
          set((s) => ({ queries: setQuery(s.queries, key, fail(queryAt(s.queries, key), errorMessage(error))) }));
        }
      },
      ensureThisDay: async (city, date) => {
        const key = `${city.id}:${date.slice(5)}`;
        if (get().thisDay[key] !== undefined || isLoading(get().queries[key])) { return; }
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        const thisYear = +date.slice(0, 4);
        const years = [...BACK.map((n) => thisYear - n), FIRST_YEAR];
        const rows: ArchiveYear[] = await Promise.all(years.map(async (year) => {
          const day = `${year}${date.slice(4)}`;
          try {
            const r = await fetchArchive(city, day, day);
            return { year, hi: r.temperature_2m_max?.[0] ?? undefined, lo: r.temperature_2m_min?.[0] ?? undefined, mm: r.precipitation_sum?.[0] ?? undefined };
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
