import { del as legacyDel, get as legacyGet } from 'idb-keyval';

import { idbGet, idbSet } from './core/idb';

import type { City, DayRecord, LegacyEnvelope, LegacyLog, LegacyState } from './types';

const LEGACY_KEY = 'open-weather-log';

const envelope = <T>(state: T) => ({ state, version: 1 });

function legacyHistory(history: LegacyState['history']): LegacyLog {
  const dayTable: Record<string, DayRecord> = {};
  const dates: Record<string, string[]> = {};
  for (const [cityId, byDate] of Object.entries(history ?? {})) {
    const logged: string[] = [];
    for (const [date, rec] of Object.entries(byDate)) {
      const id = `${cityId}:${date}`;
      dayTable[id] = { ...rec, id, cityId, date };
      logged.push(date);
    }
    dates[cityId] = logged.toSorted((a, b) => a.localeCompare(b));
  }
  return { dayTable, dates };
}

async function writeStores(old: LegacyState, version: number): Promise<void> {
  const settings = old.settings;
  if (settings !== undefined && version < 3 && settings.accent === 'red') { settings.accent = 'green'; }
  const cities = old.cities ?? [];
  const cityTable: Record<string, City> = {};
  for (const city of cities) { cityTable[city.id] = city; }
  const { dayTable, dates } = legacyHistory(old.history);
  await Promise.all([
    settings === undefined ? Promise.resolve() : idbSet('wl2-settings', envelope({ settings })),
    idbSet('wl2-cities', envelope({ cityIds: cities.map((c) => c.id), onboarded: old.onboarded ?? cities.length > 0 })),
    idbSet('wl2-entities', envelope({ tables: { city: cityTable, dayRecord: dayTable } })),
    idbSet('wl2-log', envelope({ dates })),
    idbSet('wl2-forecasts', envelope({ forecasts: version < 2 ? {} : (old.forecasts ?? {}) })),
    idbSet('wl2-days', envelope({ days: old.days ?? {} })),
    idbSet('wl2-almanac', envelope({ normals: old.normals ?? {}, thisDay: old.thisDay ?? {} })),
  ]);
}

export async function importLegacyStore(): Promise<boolean> {
  const stored = await legacyGet<LegacyEnvelope>(LEGACY_KEY);
  if (stored?.state === undefined) { return false; }
  if ((await idbGet('wl2-cities')) !== null) {
    await legacyDel(LEGACY_KEY);
    return false;
  }
  await writeStores(stored.state, stored.version ?? 0);
  await legacyDel(LEGACY_KEY);
  return true;
}
