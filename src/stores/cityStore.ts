import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { idbStorage } from './core/persistStorage';
import { todayISO } from './core/time';
import { entityCache } from './entities/cache';

import type { CityState } from './storeTypes';
import type { City } from './types';

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      cityIds: [],
      onboarded: false,
      follow: (geo) => {
        const id = String(geo.id);
        const existing = get().cityIds.indexOf(id);
        if (existing !== -1) {return { id, index: existing, added: false };}
        const city: City = {
          id,
          name: geo.name,
          region: [geo.admin1, geo.country].filter(Boolean).join(', '),
          lat: geo.latitude,
          lon: geo.longitude,
          followedAt: todayISO(),
        };
        entityCache.upsert('city', city);
        set((s) => ({ cityIds: [...s.cityIds, id], onboarded: true }));
        return { id, index: get().cityIds.length - 1, added: true };
      },
      unfollow: (id) => set((s) => ({ cityIds: s.cityIds.filter((c) => c !== id) })),
      arrange: (ids) => set((s) => {
        const same = ids.length === s.cityIds.length && s.cityIds.every((id) => ids.includes(id));
        const changed = ids.some((id, i) => id !== s.cityIds[i]);
        return same && changed ? { cityIds: [...ids] } : s;
      }),
      makeDefault: (id) => set((s) => (s.cityIds.includes(id)
        ? { cityIds: [id, ...s.cityIds.filter((c) => c !== id)] }
        : s)),
      addMany: (cities) => {
        const known = new Set(get().cityIds);
        const fresh = cities.filter((c) => !known.has(c.id));
        if (fresh.length === 0) { return []; }
        entityCache.upsertMany('city', fresh);
        set((s) => ({ cityIds: [...s.cityIds, ...fresh.map((c) => c.id)], onboarded: true }));
        return fresh.map((c) => c.id);
      },
    }),
    {
      name: 'wl2-cities',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ cityIds: s.cityIds, onboarded: s.onboarded }),
    },
  ),
);

export function followedCities(): City[] {
  return entityCache.getMany('city', useCityStore.getState().cityIds);
}
