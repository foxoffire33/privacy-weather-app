import { useAlmanacStore } from './almanacStore';
import { noteStorageFault } from './bootStore';
import { followedCities, useCityStore } from './cityStore';
import { isOffline } from './core/config';
import { writeImport } from './core/idb';
import { once, READY } from './core/inflight';
import { flushPersistedState, withoutPersistWrites } from './core/persistStorage';
import { clearRecordsMany, flushRecords, restore } from './core/recordSync';
import { DAY_PREFIX, useDayStore } from './dayStore';
import { ENTITY_PREFIX, entityCache, foldEntity, useEntityCache } from './entities/cache';
import { dayKey } from './entities/schema';
import { radarKey } from './factories/radar';
import { useForecastStore } from './forecastStore';
import { whenHistoryReady } from './hydration';
import { LOG_PREFIX, useLogStore } from './logStore';
import { currentRadarSource, useRadarStore } from './radarStore';
import { useSettingsStore } from './settingsStore';

import type { IdbEntry, Pending } from './core/types';
import type { ImportCounts, LogState } from './storeTypes';
import type { Backup, BackupDay, BackupParts, DayRecord, GeoResult, ImportedCounts, RefreshOptions, Settings, Snapshot, StoredCounts, } from './types';

const TEN_MIN = 10 * 60 * 1000;

export const resourceKey = {
  forecast: (cityId: string): string => `forecast:${cityId}`,
  day: (cityId: string, date: string): string => `day:${cityId}:${date}`,
  lookup: (cityId: string, date: string): string => `lookup:${cityId}:${date}`,
  thisDay: (cityId: string, date: string): string => `thisDay:${cityId}:${date.slice(5)}`,
  radar: (cityId: string, cell: number, key = radarKey(cityId, cell, currentRadarSource())): string => `radar:${key}`,
};

export function loadRadar(cityId: string, cell: number): Pending {
  return once(resourceKey.radar(cityId, cell), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city !== undefined) { await useRadarStore.getState().load(city, cell); }
  });
}

export function refreshCity(cityId: string, opts: RefreshOptions = {}): Pending {
  if (isOffline()) { return READY; }
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
  useRadarStore.getState().drop(cityId);
}

export function openDay(cityId: string, date: string): Pending {
  if (isOffline()) { return READY; }
  return once(resourceKey.day(cityId, date), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city === undefined) { return; }
    const day = await useDayStore.getState().load(city, date);
    if (day !== null) { useLogStore.getState().logDay(cityId, day); }
  });
}

export function lookupDate(cityId: string, date: string): Pending {
  if (isOffline()) { return READY; }
  return once(resourceKey.lookup(cityId, date), async () => {
    const city = entityCache.getOne('city', cityId);
    if (city === undefined || date === '') { return; }
    await useLogStore.getState().lookup(city, date);
  });
}

export function loadThisDay(cityId: string, date: string): Pending {
  if (isOffline()) { return READY; }
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

export async function restoreDay(cityId: string, date: string): Promise<void> {
  if (isOffline()) { return; }
  const city = entityCache.getOne('city', cityId);
  if (city === undefined) { return; }
  await useLogStore.getState().restoreDay(city, date);
}

export async function fillRange(cityId: string, start: string, end: string): Promise<void> {
  if (isOffline()) { return; }
  const city = entityCache.getOne('city', cityId);
  if (city === undefined) { return; }
  await useLogStore.getState().fillMissing(city, start, end);
}

interface ImportPlan {
  counts: ImportedCounts;
  kv: IdbEntry[];
  records: IdbEntry[];
  newCities: string[];
  cityIds: string[];
  onboarded: boolean;
  dates: LogState['dates'];
  settings: Settings;
  cities: ReturnType<typeof useEntityCache.getState>['tables']['city'];
  days: ReturnType<typeof useEntityCache.getState>['tables']['dayRecord'];
}

function prepareImport(backup: Backup, parts: BackupParts): ImportPlan {
  const cityState = useCityStore.getState();
  const known = new Set(cityState.cityIds);
  const added = parts.cities ? backup.cities.filter((city) => !known.has(city.id)) : [];
  const cityIds = [...cityState.cityIds, ...added.map((city) => city.id)];
  const followed = new Set(cityIds);
  const current = useEntityCache.getState().tables;
  const cities = { ...current.city };
  const days = { ...current.dayRecord };
  const dates = { ...useLogStore.getState().dates };
  const settings = parts.settings ? { ...useSettingsStore.getState().settings, ...backup.settings } : useSettingsStore.getState().settings;
  const kv: IdbEntry[] = [];
  const records: IdbEntry[] = [];
  let dayCount = 0;
  for (const city of added) {
    cities[city.id] = city;
    records.push([`${ENTITY_PREFIX}city:${city.id}`, city]);
  }
  if (parts.history) {
    for (const [cityId, byDate] of Object.entries(backup.history)) {
      if (!followed.has(cityId)) { continue; }
      const existingDates = dates[cityId] ?? [];
      const additions = Object.keys(byDate);
      const nextDates = [...new Set([...existingDates, ...additions])].toSorted((a, b) => a.localeCompare(b));
      dates[cityId] = nextDates;
      dayCount += nextDates.length - existingDates.length;
      records.push([LOG_PREFIX + cityId, nextDates]);
      for (const [date, entry] of Object.entries(byDate)) {
        const id = dayKey(cityId, date);
        const incoming: DayRecord = { ...entry, id, cityId, date };
        const next = foldEntity(days[id], incoming, 'dayRecord');
        days[id] = next;
        records.push([`${ENTITY_PREFIX}dayRecord:${id}`, next]);
      }
    }
  }
  const onboarded = cityState.onboarded || added.length > 0;
  if (added.length > 0) {
    kv.push(['wl2-cities', { state: { cityIds, onboarded }, version: 1 }]);
  }
  if (parts.settings) { kv.push(['wl2-settings', { state: { settings }, version: 1 }]); }
  return { counts: { cities: added.length, days: dayCount }, kv, records, newCities: added.map((city) => city.id), cityIds, onboarded, dates, settings, cities, days };
}

function applyImport(plan: ImportPlan, parts: BackupParts): void {
  useEntityCache.setState((state) => ({ tables: { ...state.tables, city: plan.cities, dayRecord: plan.days } }));
  restore(() => { useLogStore.setState({ dates: plan.dates }); });
  withoutPersistWrites(() => {
    if (parts.cities) { useCityStore.setState({ cityIds: plan.cityIds, onboarded: plan.onboarded }); }
    if (parts.settings) { useSettingsStore.setState({ settings: plan.settings }); }
  });
  for (const id of plan.newCities) { void refreshCity(id, { maxAgeMs: 0 }); }
}

export async function importBackup(backup: Backup, parts: BackupParts): Promise<ImportedCounts> {
  await whenHistoryReady();
  await Promise.all([flushPersistedState(), flushRecords()]);
  const plan = prepareImport(backup, parts);
  await writeImport(plan.kv, plan.records);
  applyImport(plan, parts);
  return plan.counts;
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

export async function clearHistory(): Promise<void> {
  await whenHistoryReady();
  const before = useEntityCache.getState().tables.dayRecord;
  try {
    await clearRecordsMany([`${ENTITY_PREFIX}dayRecord:`, LOG_PREFIX, DAY_PREFIX]);
  } catch (error) {
    noteStorageFault(error);
    throw error;
  }
  const current = useEntityCache.getState().tables.dayRecord;
  const retained = Object.fromEntries(Object.entries(current).filter(([id, record]) => record !== before[id]));
  restore(() => {
    useEntityCache.setState((state) => ({ tables: { ...state.tables, dayRecord: retained } }));
    useLogStore.setState((state) => ({
      dates: Object.fromEntries(Object.entries(state.dates).map(([cityId, dates]) => [cityId, (dates ?? []).filter((date) => retained[dayKey(cityId, date)] !== undefined)])),
      queries: {},
    }));
    useDayStore.getState().clearMemory();
  });
  useAlmanacStore.getState().clear();
}

export { followedCities } from './cityStore';
