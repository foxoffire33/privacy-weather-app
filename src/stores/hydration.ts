import { useAlmanacStore } from './almanacStore';
import { useBootStore } from './bootStore';
import { useCityStore } from './cityStore';
import { inSequence, isRecord } from './core/guards';
import { idbDel, idbGet, recordsWrite } from './core/idb';
import { READY } from './core/inflight';
import { measure, whenIdle, yieldToMain } from './core/marks';
import { waitForHydration } from './core/persistStorage';
import { readRange, restore } from './core/recordSync';
import { addDays, todayISO } from './core/time';
import { DAY_PREFIX } from './dayStore';
import { ENTITY_PREFIX, isPersistedEntities, useEntityCache } from './entities/cache';
import { FORECAST_PREFIX, restoreForecasts } from './forecastStore';
import { LOG_PREFIX, restoreLog } from './logStore';
import { importLegacyStore } from './migrateLegacy';
import { useSettingsStore } from './settingsStore';

import type { IdbEntry, Pending, Rehydratable } from './core/types';
import type { City, DayRecord, ForecastEntry } from './types';

const PERSISTED: Rehydratable[] = [
  useSettingsStore,
  useCityStore,
  useAlmanacStore,
];

const RECENT_DAYS = 120;
const FIRST_DECADE = 1940;

let booting: Promise<void> | null = null;
let history: Promise<void> | null = null;
let historyDone = false;

const isCity = (v: unknown): v is City => isRecord(v) && typeof v.id === 'string' && typeof v.lat === 'number';
const isDay = (v: unknown): v is DayRecord => isRecord(v) && typeof v.id === 'string' && typeof v.date === 'string';
const isForecast = (v: unknown): v is ForecastEntry => isRecord(v) && isRecord(v.data) && typeof v.fetchedAt === 'number';
const isDates = (v: unknown): v is string[] => Array.isArray(v) && v.every((d) => typeof d === 'string');

function stateOf(envelope: unknown, field: string): Record<string, unknown> | null {
  if (!isRecord(envelope) || !isRecord(envelope.state)) { return null; }
  const value = envelope.state[field];
  return isRecord(value) ? value : null;
}

const prefixed = (prefix: string, map: Record<string, unknown> | null): IdbEntry[] =>
  Object.entries(map ?? {}).map(([id, value]): IdbEntry => [prefix + id, value]);

function entityEntries(envelope: unknown): IdbEntry[] {
  const tables = isRecord(envelope) && isPersistedEntities(envelope.state) ? envelope.state.tables : null;
  const cities = Object.values(tables?.city ?? {}).flatMap((c): IdbEntry[] => (c === undefined ? [] : [[`${ENTITY_PREFIX}city:${c.id}`, c]]));
  const days = Object.values(tables?.dayRecord ?? {}).flatMap((d): IdbEntry[] => (d === undefined ? [] : [[`${ENTITY_PREFIX}dayRecord:${d.id}`, d]]));
  return [...cities, ...days];
}

async function migrateKvToRecords(): Promise<void> {
  const [entities, forecasts, log, days] = await Promise.all(['wl2-entities', 'wl2-forecasts', 'wl2-log', 'wl2-days'].map(async (k) => idbGet(k)));
  if (entities === null && forecasts === null && log === null && days === null) { return; }
  await recordsWrite([
    ...entityEntries(entities),
    ...prefixed(FORECAST_PREFIX, stateOf(forecasts, 'forecasts')),
    ...prefixed(LOG_PREFIX, stateOf(log, 'dates')),
    ...prefixed(DAY_PREFIX, stateOf(days, 'days')),
  ], []);
  await Promise.all(['wl2-entities', 'wl2-forecasts', 'wl2-log', 'wl2-days'].map(async (k) => idbDel(k)));
}

const values = <T>(rows: IdbEntry[], guard: (v: unknown) => v is T): T[] => rows.flatMap(([, v]) => (guard(v) ? [v] : []));

async function restoreCore(): Promise<void> {
  const [cities, forecasts, logs] = await Promise.all([
    readRange(`${ENTITY_PREFIX}city:`),
    readRange(FORECAST_PREFIX),
    readRange(LOG_PREFIX),
  ]);
  restore(() => { useEntityCache.getState().hydrate('city', values(cities, isCity)); });
  restoreForecasts(Object.fromEntries(forecasts.flatMap(([k, v]): [string, ForecastEntry][] => (isForecast(v) ? [[k, v]] : []))));
  restoreLog(Object.fromEntries(logs.flatMap(([k, v]): [string, string[]][] => (isDates(v) ? [[k, v]] : []))));
}

async function restoreDays(cityId: string, from: string, to: string): Promise<void> {
  const rows = await readRange(`${ENTITY_PREFIX}dayRecord:${cityId}:`, from, to);
  restore(() => { useEntityCache.getState().hydrate('dayRecord', values(rows, isDay)); });
}

async function restoreRecent(): Promise<void> {
  const from = addDays(todayISO(), -RECENT_DAYS);
  await Promise.all(useCityStore.getState().cityIds.map(async (id) => restoreDays(id, from, '\uFFFF')));
}

async function restoreHistory(): Promise<void> {
  const before = addDays(todayISO(), -RECENT_DAYS);
  const lastDecade = Math.floor(Number(before.slice(0, 4)) / 10) * 10;
  const decades = Array.from({ length: (lastDecade - FIRST_DECADE) / 10 + 1 }, (_, i) => lastDecade - i * 10);
  const chunks = useCityStore.getState().cityIds.flatMap((id) => decades.map((decade) => (
    { id, from: String(decade), to: decade === lastDecade ? before : String(decade + 10) }
  )));
  await inSequence(chunks, async ({ id, from, to }) => {
    await restoreDays(id, from, to);
    await yieldToMain();
  });
  historyDone = true;
  useBootStore.setState({ historyReady: true });
}

export function hydrateAll(): Pending {
  booting ??= measure('hydrate', async () => {
    await importLegacyStore().catch(() => false);
    await migrateKvToRecords().catch(() => null);
    await Promise.all([
      ...PERSISTED.map(async (store) => {
        await store.persist.rehydrate();
        await waitForHydration(store);
      }),
      restoreCore(),
    ]);
    await restoreRecent();
    useBootStore.setState({ hydrated: true });
    whenIdle(() => { void whenHistoryReady(); });
  });
  return booting;
}

export function whenHistoryReady(): Pending {
  if (historyDone) { return READY; }
  history ??= (async () => {
    await hydrateAll();
    await measure('hydrate-history', restoreHistory);
  })();
  return history;
}
