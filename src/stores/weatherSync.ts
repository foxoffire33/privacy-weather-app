import { useAlmanacStore } from './almanacStore';
import { followedCities, useCityStore } from './cityStore';
import { once } from './core/inflight';
import { useDayStore } from './dayStore';
import { entityCache } from './entities/cache';
import { dayKey } from './entities/schema';
import { useForecastStore } from './forecastStore';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';

import type { ImportCounts } from './storeTypes';
import type { Backup, BackupDay, BackupParts, City, DayRecord, GeoResult, ImportedCounts, RefreshOptions, Snapshot, StoredCounts,  } from './types';

const TEN_MIN = 10 * 60 * 1000;

export const resourceKey = {
  forecast: (cityId: string) => `forecast:${cityId}`,
  day: (cityId: string, date: string) => `day:${cityId}:${date}`,
  lookup: (cityId: string, date: string) => `lookup:${cityId}:${date}`,
  thisDay: (cityId: string, date: string) => `thisDay:${cityId}:${date.slice(5)}`,
};

export async function refreshCity(cityId: string, opts: RefreshOptions = {}): Promise<void> {
  return once(resourceKey.forecast(cityId), async () => { await runRefresh(cityId, opts); });
}

async function runRefresh(cityId: string, opts: RefreshOptions): Promise<void> {
  const city = entityCache.getOne('city', cityId);
  if (city === undefined) { return; }
  const log = useLogStore.getState();
  const gap = useSettingsStore.getState().settings.backfill ? log.gapDays(cityId) : 0;
  const pastDays = Math.max(1, gap);
  const entry = await useForecastStore.getState().refresh(city, { pastDays, maxAgeMs: opts.maxAgeMs ?? TEN_MIN });
  if (entry === null) { return; }
  log.recordForecast(cityId, entry.data, entry.pastDays, gap);
  void useAlmanacStore.getState().ensureNormals(city);
}

export async function refreshAll(opts: RefreshOptions = {}): Promise<void> {
  await Promise.all(useCityStore.getState().cityIds.map(async (id) => { await refreshCity(id, opts); }));
}

export function followCity(geo: GeoResult): number {
  const { id, index, added } = useCityStore.getState().follow(geo);
  if (added) {void refreshCity(id, { maxAgeMs: 0 });}
  return index;
}

export function unfollowCity(cityId: string): void {
  useCityStore.getState().unfollow(cityId);
  useForecastStore.getState().drop(cityId);
}

export async function openDay(cityId: string, date: string): Promise<void> {
  return once(resourceKey.day(cityId, date), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city === undefined) { return; }
    const day = await useDayStore.getState().load(city, date);
    if (day !== null) { useLogStore.getState().logDay(cityId, day); }
  });
}

export async function lookupDate(cityId: string, date: string): Promise<void> {
  return once(resourceKey.lookup(cityId, date), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city === undefined || date === '') { return; }
    await useLogStore.getState().lookup(city, date);
  });
}

export async function loadThisDay(cityId: string, date: string): Promise<void> {
  return once(resourceKey.thisDay(cityId, date), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city === undefined) { return; }
    await useAlmanacStore.getState().ensureThisDay(city, date);
  });
}

export async function addDateRange(cityId: string, start: string, end: string): Promise<ImportCounts> {
  const city = entityCache.getOne('city', cityId);
  if (city === undefined) { throw new Error('city-not-followed'); }
  return useLogStore.getState().fillMissing(city, start, end);
}

export async function addDayToLog(cityId: string, date: string): Promise<void> {
  if (entityCache.getOne('dayRecord', dayKey(cityId, date)) !== undefined) {
    useLogStore.getState().addDates(cityId, [date]);
    return;
  }
  await addDateRange(cityId, date, date);
}

export async function fillRange(cityId: string, start: string, end: string): Promise<void> {
  const city = entityCache.getOne('city', cityId);
  if (city === undefined) { return; }
  await useLogStore.getState().fillMissing(city, start, end);
}

export function importBackup(backup: Backup, parts: BackupParts): ImportedCounts {
  const addedIds = parts.cities ? useCityStore.getState().addMany(backup.cities) : [];
  let days = 0;
  if (parts.history) {
    const followed = new Set(useCityStore.getState().cityIds);
    const log = useLogStore.getState();
    for (const [cityId, byDate] of Object.entries(backup.history)) {
      if (!followed.has(cityId)) { continue; }
      const records: DayRecord[] = Object.entries(byDate).map(([date, rec]) => ({
        ...rec, id: dayKey(cityId, date), cityId, date,
      }));
      entityCache.upsertMany('dayRecord', records);
      days += log.addDates(cityId, records.map((r) => r.date));
    }
  }

  if (parts.settings) { useSettingsStore.getState().updateSettings(backup.settings); }
  for (const id of addedIds) {void refreshCity(id, { maxAgeMs: 0 });}
  return { cities: addedIds.length, days };
}

export function exportSnapshot(): Snapshot {
  const history: Snapshot['history'] = {};
  const { dates } = useLogStore.getState();
  for (const [cityId, days] of Object.entries(dates)) {
    const byDate: Record<string, BackupDay> = {};
    for (const record of entityCache.getMany('dayRecord', (days ?? []).map((d) => dayKey(cityId, d)))) {
      const { id: _id, cityId: _cityId, ...rest } = record;
      byDate[record.date] = rest;
    }
    if (Object.keys(byDate).length > 0) { history[cityId] = byDate; }
  }
  return { cities: followedCities(), history, settings: useSettingsStore.getState().settings };
}

export function storedCounts(): StoredCounts {
  const { dates } = useLogStore.getState();
  return {
    cities: useCityStore.getState().cityIds.length,
    days: Object.values(dates).reduce((n, days) => n + (days?.length ?? 0), 0),
  };
}

export function clearHistory(): void {
  useLogStore.getState().clear();
  useAlmanacStore.getState().clear();
  useDayStore.getState().clear();
}


export const cityById = (id: string): City | undefined => entityCache.getOne('city', id);

export { followedCities } from './cityStore';