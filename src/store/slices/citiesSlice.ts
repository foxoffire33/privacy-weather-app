import { todayISO } from '../../lib/format';
import type { City } from '../../types';
import type { CitiesSlice, SliceCreator } from '../types';

// Privacy: no device location. Cities are only added by name search.
export const createCitiesSlice: SliceCreator<CitiesSlice> = (set, get) => ({
  cities: [],
  onboarded: false,

  followCity: (geo) => {
    const id = String(geo.id);
    const existing = get().cities.findIndex((c) => c.id === id);
    if (existing >= 0) return existing;
    const city: City = {
      id,
      name: geo.name,
      region: [geo.admin1, geo.country].filter(Boolean).join(', '),
      lat: geo.latitude,
      lon: geo.longitude,
      followedAt: todayISO(),
    };
    set((s) => ({ cities: [...s.cities, city], onboarded: true }));
    void get().refreshCity(id, { maxAgeMs: 0 });
    return get().cities.length - 1;
  },

  unfollowCity: (id) => set((s) => {
    const forecasts = { ...s.forecasts };
    delete forecasts[id];
    return { cities: s.cities.filter((c) => c.id !== id), forecasts, pageIndex: 0 };
  }),

  moveCity: (id, dir) => set((s) => {
    const list = [...s.cities];
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return {};
    [list[i], list[j]] = [list[j], list[i]];
    return { cities: list, pageIndex: 0 };
  }),

  makeDefault: (id) => set((s) => {
    const city = s.cities.find((c) => c.id === id);
    if (!city) return {};
    return { cities: [city, ...s.cities.filter((c) => c.id !== id)], pageIndex: 0 };
  }),
});
