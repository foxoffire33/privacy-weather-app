import { fetchAirQuality, fetchForecast, fetchMarine } from '../../api/openMeteo';
import type { ForecastSlice, SliceCreator } from '../types';

const TEN_MIN = 10 * 60 * 1000;

export const createForecastSlice: SliceCreator<ForecastSlice> = (set, get) => ({
  forecasts: {},
  status: {},

  refreshCity: async (id, { maxAgeMs = TEN_MIN } = {}) => {
    const city = get().cities.find((c) => c.id === id);
    if (!city || get().status[id]?.loading) return;
    const cached = get().forecasts[id];
    if (cached && Date.now() - cached.fetchedAt < maxAgeMs) return;

    const { settings } = get();
    set((s) => ({ status: { ...s.status, [id]: { loading: true, error: null } } }));
    try {
      const gap = settings.backfill ? get().gapDays(id) : 0;
      const pastDays = Math.max(1, gap); // always include yesterday (daylight change, pressure trend)
      const [data, air, marine] = await Promise.all([
        fetchForecast(city, settings, pastDays),
        fetchAirQuality(city, settings).catch(() => null),
        fetchMarine(city, settings).catch(() => null),
      ]);
      set((s) => ({
        forecasts: { ...s.forecasts, [id]: { data, air, marine, pastDays, fetchedAt: Date.now() } },
        status: { ...s.status, [id]: { loading: false, error: null } },
      }));
      get().recordForecast(id, data, pastDays, gap);
      if (!get().normals[id]) void get().loadNormals(id);
    } catch (e) {
      set((s) => ({ status: { ...s.status, [id]: { loading: false, error: (e as Error).message } } }));
    }
  },

  refreshAll: async (opts) => {
    await Promise.all(get().cities.map((c) => get().refreshCity(c.id, opts)));
  },
});
