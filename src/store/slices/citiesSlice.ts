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

  reorderCities: (from, to) => set((s) => {
    if (from === to || from < 0 || to < 0 || from >= s.cities.length || to >= s.cities.length) return {};
    const list = [...s.cities];
    list.splice(to, 0, list.splice(from, 1)[0]);
    return { cities: list, pageIndex: 0 };
  }),

  // Merge, never replace: cities already followed stay where they are, and days this device logged itself
  // ('log') win over imported ones. Days are only imported for cities that are followed afterwards.
  importBackup: (backup, parts) => {
    const before = get().cities;
    const known = new Set(before.map((c) => c.id));
    const added = parts.cities ? backup.cities.filter((c) => !known.has(c.id)) : [];
    let days = 0;
    set((s) => {
      const cities = [...s.cities, ...added];
      const ids = new Set(cities.map((c) => c.id));
      const history = { ...s.history };
      if (parts.history) {
        for (const [id, log] of Object.entries(backup.history)) {
          if (!ids.has(id)) continue;
          const merged = { ...(history[id] ?? {}) };
          for (const [date, rec] of Object.entries(log)) {
            if (merged[date]?.source === 'log') continue;
            merged[date] = rec;
            days++;
          }
          history[id] = merged;
        }
      }
      return {
        cities, history, onboarded: s.onboarded || cities.length > 0,
        settings: parts.settings ? { ...s.settings, ...backup.settings } : s.settings,
      };
    });
    added.forEach((c) => void get().refreshCity(c.id, { maxAgeMs: 0 }));
    return { cities: added.length, days };
  },

  makeDefault: (id) => set((s) => {
    const city = s.cities.find((c) => c.id === id);
    if (!city) return {};
    return { cities: [city, ...s.cities.filter((c) => c.id !== id)], pageIndex: 0 };
  }),
});
