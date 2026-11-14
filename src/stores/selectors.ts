import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useAlmanacStore } from './almanacStore';
import { useBootStore } from './bootStore';
import { useCityStore } from './cityStore';
import { IDLE_QUERY } from './core/types';
import { useDayStore } from './dayStore';
import { useEntityCache } from './entities/cache';
import { dayKey } from './entities/schema';
import { useForecastStore } from './forecastStore';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';

import type { QueryState } from './core/types';
import type { ArchiveYear, City, DayData, DayRecord, ForecastEntry, LogNeighbours, LookupView, Settings, Units } from './types';

export const useSettings = (): Settings => useSettingsStore((s) => s.settings);
export const useUpdateSettings = (): ((patch: Partial<Settings>) => void) => useSettingsStore((s) => s.updateSettings);

export const useUnits = (): Units =>
  useSettingsStore(useShallow((s) => ({ temp: s.settings.tempUnit, wind: s.settings.windUnit })));

export function useCities(): City[] {
  const ids = useCityStore((s) => s.cityIds);
  const table = useEntityCache((s) => s.tables.city);
  return useMemo(() => ids.map((id) => table[id]).filter((c): c is City => c !== undefined), [ids, table]);
}

export const useCity = (cityId: string): City | undefined => useEntityCache((s) => s.tables.city[cityId]);

export const useCityIndex = (cityId: string): number => useCityStore((s) => s.cityIds.indexOf(cityId));

export const useForecast = (cityId: string): ForecastEntry | undefined => useForecastStore((s) => s.forecasts[cityId]);

export const useForecastQuery = (cityId: string): QueryState =>
  useForecastStore((s) => s.queries[cityId] ?? IDLE_QUERY);

export const useAnyForecastLoading = (): boolean =>
  useForecastStore((s) => Object.values(s.queries).some((q) => q.status === 'loading'));

export function useCityLog(cityId: string): Record<string, DayRecord> {
  const dates = useLogStore((s) => s.dates[cityId]);
  const table = useEntityCache((s) => s.tables.dayRecord);
  return useMemo(() => {
    const out: Record<string, DayRecord> = {};
    for (const date of dates ?? []) {
      const record = table[dayKey(cityId, date)];
      if (record !== undefined) { out[date] = record; }
    }
    return out;
  }, [cityId, dates, table]);
}

export const useLogCount = (cityId: string): number => useLogStore((s) => (s.dates[cityId] ?? []).length);

export const useRestoreQuery = (cityId: string, date: string): QueryState =>
  useLogStore((s) => s.queries[`restore:${dayKey(cityId, date)}`] ?? IDLE_QUERY);

export function useLogNeighbours(cityId: string, date: string): LogNeighbours {
  const prev = useLogStore((s) => (s.dates[cityId] ?? []).findLast((d) => d < date));
  const next = useLogStore((s) => (s.dates[cityId] ?? []).find((d) => d > date));
  return { prev, next };
}

export const useDayRecord = (cityId: string, date: string): DayRecord | undefined =>
  useEntityCache((s) => s.tables.dayRecord[dayKey(cityId, date)]);

export function useLookup(cityId: string, date: string): LookupView {
  const record = useDayRecord(cityId, date);
  const query = useLogStore((s) => s.queries[dayKey(cityId, date)] ?? IDLE_QUERY);
  return { record, query };
}

export const useImportQuery = (cityId: string): QueryState =>
  useLogStore((s) => s.queries[`import:${cityId}`] ?? IDLE_QUERY);

export const useDay = (cityId: string, date: string): DayData | undefined =>
  useDayStore((s) => s.days[dayKey(cityId, date)]);

export const useDayQuery = (cityId: string, date: string): QueryState =>
  useDayStore((s) => s.queries[dayKey(cityId, date)] ?? IDLE_QUERY);

export const useNormals = (cityId: string): Record<string, number> | undefined =>
  useAlmanacStore((s) => s.normals[cityId]);

export const useThisDay = (cityId: string, date: string): ArchiveYear[] | undefined =>
  useAlmanacStore((s) => s.thisDay[`${cityId}:${date.slice(5)}`]);

export const useIsHydrated = (): boolean => useBootStore((s) => s.hydrated);
