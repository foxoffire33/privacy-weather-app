import { del as legacyDel, get as legacyGet } from 'idb-keyval';
import { idbGet, idbSet } from './core/idb';
import type { ArchiveYear, City, DayData, DayRecord, ForecastEntry, Settings } from './types';

const LEGACY_KEY = 'open-weather-log';

interface LegacyState {
  settings?: Settings;
  cities?: City[];
  onboarded?: boolean;
  forecasts?: Record<string, ForecastEntry>;
  history?: Record<string, Record<string, Omit<DayRecord, 'id' | 'cityId'>>>;
  normals?: Record<string, Record<string, number>>;
  thisDay?: Record<string, ArchiveYear[]>;
  days?: Record<string, DayData>;
}

const envelope = <T>(state: T) => ({ state, version: 1 });

export async function importLegacyStore(): Promise<boolean> {
  const stored = await legacyGet<{ state?: LegacyState; version?: number }>(LEGACY_KEY);
  if (stored?.state === undefined) return false;
  if ((await idbGet('wl2-cities')) !== null) {
    await legacyDel(LEGACY_KEY);
    return false;
  }

  const version = stored.version ?? 0;
  const old = stored.state;
  const forecasts = version < 2 ? {} : (old.forecasts ?? {});
  const settings = old.settings;
  if (settings !== undefined && version < 3 && settings.accent === 'red') settings.accent = 'green';
  const cities = old.cities ?? [];
  const cityTable: Record<string, City> = {};
  for (const city of cities) cityTable[city.id] = city;
  const dayTable: Record<string, DayRecord> = {};
  const dates: Record<string, string[]> = {};
  for (const [cityId, byDate] of Object.entries(old.history ?? {})) {
    const logged: string[] = [];
    for (const [date, rec] of Object.entries(byDate)) {
      const id = `${cityId}:${date}`;
      dayTable[id] = { ...rec, id, cityId, date };
      logged.push(date);
    }
    dates[cityId] = logged.sort();
  }

  await Promise.all([
    settings === undefined ? Promise.resolve() : idbSet('wl2-settings', envelope({ settings })),
    idbSet('wl2-cities', envelope({ cityIds: cities.map((c) => c.id), onboarded: old.onboarded ?? cities.length > 0 })),
    idbSet('wl2-entities', envelope({ tables: { city: cityTable, dayRecord: dayTable } })),
    idbSet('wl2-log', envelope({ dates })),
    idbSet('wl2-forecasts', envelope({ forecasts })),
    idbSet('wl2-days', envelope({ days: old.days ?? {} })),
    idbSet('wl2-almanac', envelope({ normals: old.normals ?? {}, thisDay: old.thisDay ?? {} })),
  ]);
  await legacyDel(LEGACY_KEY);
  return true;
}
