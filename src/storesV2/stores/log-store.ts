import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { errorMessage } from '../core/errors';
import { idbStorage } from '../core/persist-storage';
import type { QueryMap, QueryState } from '../core/types';
import { entityCache } from '../entities/cache';
import { dayKey } from '../entities/schema';
import { begin, fail, IDLE_QUERY, isLoading, queryAt, setQuery, succeed } from '../factory/query-state';
import { fetchDailyRange } from '../api/open-meteo';
import { fromDayData, fromForecastDaily, fromRangeRow, isEmptyRecord } from '../api/day-record';
import { LOG_ARCHIVE_VARS, LOG_FORECAST_VARS } from '../api/variables';
import { addDays, daysBetween, todayISO } from '../core/time';
import type { City, DayData, DayRecord, ForecastData } from '../types';
import type { ImportCounts, LogState } from './types';

export type { ImportCounts, LogState } from './types';

const FORECAST_PAST_DAYS = 92;

export const NO_ARCHIVE_DATA = 'no-archive-data';

const sortedUnion = (existing: readonly string[], added: readonly string[]): string[] =>
  [...new Set([...existing, ...added])].sort();

function sources(start: string, end: string): { from: string; to: string; recent: boolean }[] {
  const horizon = addDays(todayISO(), -FORECAST_PAST_DAYS);
  const parts: { from: string; to: string; recent: boolean }[] = [];
  if (start < horizon) parts.push({ from: start, to: end < horizon ? end : addDays(horizon, -1), recent: false });
  if (end >= horizon) parts.push({ from: start > horizon ? start : horizon, to: end, recent: true });
  return parts;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      dates: {},
      queries: {},
      gapDays: (cityId) => {
        const logged = get().dates[cityId];
        const city = entityCache.getOne('city', cityId);
        const from = logged?.length ? logged[logged.length - 1] : city?.followedAt;
        if (from === undefined) return 0;
        return Math.min(FORECAST_PAST_DAYS, Math.max(0, daysBetween(from, todayISO())));
      },
      recordForecast: (cityId, data, pastDays, gap) => {
        const records: DayRecord[] = [];
        const first = Math.max(0, pastDays - Math.max(gap, 1));
        for (let i = first; i <= pastDays && i < data.daily.time.length; i++) {
          records.push(fromForecastDaily(cityId, data, i, i === pastDays ? 'log' : 'filled'));
        }
        if (records.length === 0) return;
        entityCache.upsertMany('dayRecord', records);
        const today = records[records.length - 1];
        entityCache.merge('dayRecord', today.id, { snapshots: (entityCache.getOne('dayRecord', today.id)?.snapshots ?? 0) + 1 });
        set((s) => ({ dates: { ...s.dates, [cityId]: sortedUnion(s.dates[cityId] ?? [], records.map((r) => r.date)) } }));
      },
      logDay: (cityId, day) => {
        entityCache.upsert('dayRecord', fromDayData(cityId, day));
        set((s) => ({ dates: { ...s.dates, [cityId]: sortedUnion(s.dates[cityId] ?? [], [day.date]) } }));
      },
      lookup: async (city, date) => {
        const key = dayKey(city.id, date);
        if (isLoading(get().queries[key])) return;
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        try {
          const recent = date >= addDays(todayISO(), -FORECAST_PAST_DAYS);
          const rows = await fetchDailyRange(city, date, date, recent ? LOG_FORECAST_VARS : LOG_ARCHIVE_VARS, recent ? 'forecast' : 'archive');
          const record = fromRangeRow(city.id, rows, 0);
          if (isEmptyRecord(record)) throw new Error(NO_ARCHIVE_DATA);
          entityCache.upsert('dayRecord', record);
          set((s) => ({ queries: setQuery(s.queries, key, succeed()) }));
        } catch (e) {
          set((s) => ({ queries: setQuery(s.queries, key, fail(queryAt(s.queries, key), errorMessage(e))) }));
        }
      },
      addRange: async (city, start, end) => {
        const key = `import:${city.id}`;
        set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
        try {
          const parts = sources(start, end);
          const fetched = await Promise.all(parts.map((p) => fetchDailyRange(
            city, p.from, p.to, p.recent ? LOG_FORECAST_VARS : LOG_ARCHIVE_VARS, p.recent ? 'forecast' : 'archive',
          )));
          const counts: ImportCounts = { added: 0, updated: 0, kept: 0 };
          const records: DayRecord[] = [];
          for (const rows of fetched) {
            rows.time.forEach((date, i) => {
              const record = fromRangeRow(city.id, rows, i);
              if (isEmptyRecord(record)) return;
              const prev = entityCache.getOne('dayRecord', record.id);
              if (prev?.source === 'log') counts.kept++;
              else if (prev) counts.updated++;
              else counts.added++;
              records.push(record);
            });
          }
          entityCache.upsertMany('dayRecord', records);
          set((s) => ({
            dates: { ...s.dates, [city.id]: sortedUnion(s.dates[city.id] ?? [], records.map((r) => r.date)) },
            queries: setQuery(s.queries, key, succeed()),
          }));
          return counts;
        } catch (e) {
          set((s) => ({ queries: setQuery(s.queries, key, fail(queryAt(s.queries, key), errorMessage(e))) }));
          throw e;
        }
      },
      fillMissing: async (city, start, end) => {
        const logged = new Set(get().dates[city.id] ?? []);
        let first: string | null = null;
        let last: string | null = null;
        for (let d = start; d <= end; d = addDays(d, 1)) {
          if (logged.has(d)) continue;
          first ??= d;
          last = d;
        }
        if (first === null || last === null) return null;
        return await get().addRange(city, first, last);
      },
      removeDay: (cityId, date) => {
        entityCache.remove('dayRecord', dayKey(cityId, date));
        set((s) => ({ dates: { ...s.dates, [cityId]: (s.dates[cityId] ?? []).filter((d) => d !== date) } }));
      },
      addDates: (cityId, dates) => {
        const before = get().dates[cityId] ?? [];
        const after = sortedUnion(before, dates);
        set((s) => ({ dates: { ...s.dates, [cityId]: after } }));
        return after.length - before.length;
      },
      clear: () => {
        const { dates } = get();
        for (const [cityId, days] of Object.entries(dates)) {
          entityCache.removeMany('dayRecord', days.map((d) => dayKey(cityId, d)));
        }
        set({ dates: {}, queries: {} });
      },
    }),
    {
      name: 'wl2-log',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ dates: s.dates }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<LogState>), queries: {} }),
    },
  ),
);

export const lookupQuery = (cityId: string, date: string): QueryState =>
  useLogStore.getState().queries[dayKey(cityId, date)] ?? IDLE_QUERY;
