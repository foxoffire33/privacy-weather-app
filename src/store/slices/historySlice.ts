import { t } from '../../i18n';
import { fetchAirDay, fetchArchive, fetchDailyRange, fetchDay } from '../../api/openMeteo';
import { LOG_ARCHIVE_VARS, LOG_FORECAST_VARS } from '../../api/variables';
import { addDays, daysBetween, todayISO } from '../../lib/format';
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

  // Yesterday is already part of the forecast response (past_days >= 1): add it to the log if it is not there yet.
  logYesterday: (id) => set((s) => {
    const entry = s.forecasts[id];
    const i = entry ? entry.pastDays - 1 : -1;
    if (!entry || i < 0 || s.history[id]?.[entry.data.daily.time[i]]) return {};
    const { time, v } = entry.data.daily;
    const date = time[i];
    const rec: DayRecord = {
      date, hi: v.temperature_2m_max[i], lo: v.temperature_2m_min[i], feelsHi: v.apparent_temperature_max[i], feelsLo: v.apparent_temperature_min[i],
      mm: v.precipitation_sum[i], snow: v.snowfall_sum[i], wind: v.wind_speed_10m_max[i], gust: v.wind_gusts_10m_max[i],
      sunshine: v.sunshine_duration[i], uv: v.uv_index_max[i], code: v.weather_code[i], source: 'filled', snapshots: 0,
    };
    return { history: { ...s.history, [id]: { ...(s.history[id] ?? {}), [date]: rec } } };
  }),

  // A fetched past day (days[]) joins the log if it is not there yet.
  logDay: (id, date) => set((s) => {
    const d = s.days[`${id}:${date}`];
    if (!d || s.history[id]?.[date]) return {};
    const v = d.daily.v;
    const rec: DayRecord = {
      date, hi: v.temperature_2m_max ?? null, lo: v.temperature_2m_min ?? null, feelsHi: v.apparent_temperature_max ?? null, feelsLo: v.apparent_temperature_min ?? null,
      mm: v.precipitation_sum ?? null, snow: v.snowfall_sum ?? null, wind: v.wind_speed_10m_max ?? null, gust: v.wind_gusts_10m_max ?? null,
      sunshine: v.sunshine_duration ?? null, uv: v.uv_index_max ?? null, code: v.weather_code ?? null, source: 'filled', snapshots: 0,
    };
    return { history: { ...s.history, [id]: { ...(s.history[id] ?? {}), [date]: rec } } };
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
      if (d.temperature_2m_max[0] == null) throw new Error(t('history.noArchive'));
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

  deleteLogDay: (id, date) => set((s) => {
    if (!s.history[id]?.[date]) return {};
    const log = { ...s.history[id] };
    delete log[date];
    return { history: { ...s.history, [id]: log } };
  }),

  // Downloads every attribute a log entry holds. Days within the forecast API's window come
  // from there (it also has UV); older days come from the ERA5 archive, which has no UV.
  importRange: async (id, start, end) => {
    const city = get().cities.find((c) => c.id === id);
    if (!city) throw new Error(t('common.noLongerFollowed'));
    const recentFrom = addDays(todayISO(), -92);
    const parts: { from: string; to: string; recent: boolean }[] = [];
    if (start < recentFrom) parts.push({ from: start, to: end < recentFrom ? end : addDays(recentFrom, -1), recent: false });
    if (end >= recentFrom) parts.push({ from: start > recentFrom ? start : recentFrom, to: end, recent: true });

    const counts = { added: 0, updated: 0, kept: 0 };
    const fetched = await Promise.all(parts.map((p) => fetchDailyRange(
      city, p.from, p.to, get().settings, p.recent ? LOG_FORECAST_VARS : LOG_ARCHIVE_VARS, p.recent ? 'forecast' : 'archive',
    )));
    set((s) => {
      const log = { ...(s.history[id] ?? {}) };
      for (const r of fetched) {
        r.time.forEach((date, i) => {
          if (r.temperature_2m_max[i] == null) return; // not available yet
          const prev = log[date];
          if (prev?.source === 'log') { counts.kept++; return; }
          if (prev) counts.updated++; else counts.added++;
          log[date] = {
            date,
            hi: r.temperature_2m_max[i], lo: r.temperature_2m_min[i],
            feelsHi: r.apparent_temperature_max[i], feelsLo: r.apparent_temperature_min[i],
            mm: r.precipitation_sum[i], snow: r.snowfall_sum[i],
            wind: r.wind_speed_10m_max[i], gust: r.wind_gusts_10m_max[i],
            sunshine: r.sunshine_duration[i], uv: r.uv_index_max?.[i] ?? prev?.uv ?? null,
            code: r.weather_code[i],
            source: 'filled', snapshots: prev?.snapshots ?? 0,
          };
        });
      }
      return { history: { ...s.history, [id]: log } };
    });
    return counts;
  },

  clearHistory: () => set({ history: {}, thisDay: {}, lookups: {}, days: {} }),
});
