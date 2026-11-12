import { fetchAirDay, fetchArchive, fetchDay } from '../../api/openMeteo';
import { daysBetween, todayISO } from '../../lib/format';
import type { ArchiveYear, DayRecord } from '../../types';
import type { HistorySlice, SliceCreator } from '../types';

const pending = new Set<string>();

export const createHistorySlice: SliceCreator<HistorySlice> = (set, get) => ({
  history: {},  // cityId -> date -> DayRecord
  normals: {},  // cityId -> 'MM-DD' -> mean daily max 1991–2020
  thisDay: {},  // `${cityId}:MM-DD` -> past years
  lookups: {},  // `${cityId}:YYYY-MM-DD` -> archive day
  lookupDraft: '',
  days: {},
  dayStatus: {},

  // Days missed since the last log entry (max 92 = forecast API past_days limit).
  gapDays: (id) => {
    const city = get().cities.find((c) => c.id === id);
    if (!city) return 0;
    const dates = Object.keys(get().history[id] ?? {}).sort();
    const from = dates.length ? dates[dates.length - 1] : city.followedAt;
    return Math.min(92, Math.max(0, daysBetween(from, todayISO())));
  },

  // Each fetch writes today's snapshot; days the app missed are filled from past_days.
  recordForecast: (id, data, pastDays, gap) => set((s) => {
    const log = { ...(s.history[id] ?? {}) };
    const { time, v } = data.daily;
    for (let i = pastDays - gap; i <= pastDays && i < time.length; i++) {
      const date = time[i];
      const prev = log[date];
      const isToday = i === pastDays;
      const rec: DayRecord = {
        date,
        hi: v.temperature_2m_max[i],
        lo: v.temperature_2m_min[i],
        feelsHi: v.apparent_temperature_max[i],
        feelsLo: v.apparent_temperature_min[i],
        mm: v.precipitation_sum[i],
        snow: v.snowfall_sum[i],
        wind: v.wind_speed_10m_max[i],
        gust: v.wind_gusts_10m_max[i],
        sunshine: v.sunshine_duration[i],
        uv: v.uv_index_max[i],
        code: v.weather_code[i],
        source: isToday || prev?.source === 'log' ? 'log' : 'filled',
        snapshots: (prev?.snapshots ?? 0) + (isToday ? 1 : 0),
      };
      log[date] = rec;
    }
    return { history: { ...s.history, [id]: log } };
  }),

  loadNormals: async (id) => {
    const city = get().cities.find((c) => c.id === id);
    const key = `normals:${id}`;
    if (!city || pending.has(key)) return;
    pending.add(key);
    try {
      const r = await fetchArchive(city, '1991-01-01', '2020-12-31', get().settings, ['temperature_2m_max']);
      const acc: Record<string, [number, number]> = {};
      r.time.forEach((t, i) => {
        const v = r.temperature_2m_max[i];
        if (v == null) return;
        const k = t.slice(5);
        acc[k] = acc[k] ?? [0, 0];
        acc[k][0] += v;
        acc[k][1] += 1;
      });
      const out: Record<string, number> = {};
      for (const k in acc) out[k] = +(acc[k][0] / acc[k][1]).toFixed(2);
      set((s) => ({ normals: { ...s.normals, [id]: out } }));
    } catch {
      /* retried on next refresh */
    } finally {
      pending.delete(key);
    }
  },

  loadThisDay: async (id, date) => {
    const key = `${id}:${date.slice(5)}`;
    const city = get().cities.find((c) => c.id === id);
    if (!city || get().thisDay[key] || pending.has(key)) return;
    pending.add(key);
    const y = +date.slice(0, 4);
    const rows: ArchiveYear[] = await Promise.all([y - 1, y - 10, y - 30, 1940].map((year) => {
      const day = `${year}${date.slice(4)}`;
      return fetchArchive(city, day, day, get().settings)
        .then((r) => ({ year, hi: r.temperature_2m_max[0] ?? undefined, lo: r.temperature_2m_min[0] ?? undefined, mm: r.precipitation_sum[0] ?? undefined }))
        .catch(() => ({ year, error: true }));
    }));
    pending.delete(key);
    set((s) => ({ thisDay: { ...s.thisDay, [key]: rows } }));
  },

  setLookupDraft: (date) => set({ lookupDraft: date }),

  lookupDate: async (id, date) => {
    const key = `${id}:${date}`;
    const city = get().cities.find((c) => c.id === id);
    if (!city || !date) return;
    set((s) => ({ lookups: { ...s.lookups, [key]: { loading: true } } }));
    try {
      const d = await fetchArchive(city, date, date, get().settings);
      if (d.temperature_2m_max[0] == null) throw new Error('No archive data for this date yet');
      set((s) => ({ lookups: { ...s.lookups, [key]: {
        hi: d.temperature_2m_max[0] ?? undefined, lo: d.temperature_2m_min[0] ?? undefined, mm: d.precipitation_sum[0] ?? undefined,
        wind: d.wind_speed_10m_max[0] ?? undefined, code: d.weather_code[0] ?? undefined,
      } } }));
    } catch (e) {
      set((s) => ({ lookups: { ...s.lookups, [key]: { error: (e as Error).message } } }));
    }
  },

  loadDay: async (id, date) => {
    const key = `${id}:${date}`;
    const city = get().cities.find((c) => c.id === id);
    if (!city || get().days[key] || get().dayStatus[key]?.loading) return;
    set((s) => ({ dayStatus: { ...s.dayStatus, [key]: { loading: true, error: null } } }));
    try {
      const recent = daysBetween(date, todayISO()) <= 90;
      const [day, air] = await Promise.all([
        fetchDay(city, date, get().settings, recent),
        fetchAirDay(city, date, get().settings).catch(() => null),
      ]);
      set((s) => ({
        days: { ...s.days, [key]: { ...day, air } },
        dayStatus: { ...s.dayStatus, [key]: { loading: false, error: null } },
      }));
    } catch (e) {
      set((s) => ({ dayStatus: { ...s.dayStatus, [key]: { loading: false, error: (e as Error).message } } }));
    }
  },

  clearHistory: () => set({ history: {}, thisDay: {}, lookups: {}, days: {} }),
});
