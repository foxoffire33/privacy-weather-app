import { noteFailure } from '../utils/diagnostics';

import { useAlmanacStore } from './almanacStore';
import { noteStorageFault, useBootStore } from './bootStore';
import { useCityStore } from './cityStore';
import { AppError, classify } from './core/appError';
import { inSequence, isAbsent, isRecord } from './core/guards';
import { idbDel, idbGet, onUpgradeBlocked, recordsWriteMissing } from './core/idb';
import { READY } from './core/inflight';
import { yieldToMain, measure } from './core/marks';
import { requestPersistentStorage } from './core/persistence';
import { hydrationFault, registerRehydration, waitForHydration } from './core/persistStorage';
import { changedSinceStart, flushRecords, readRange, restore, trackChanges } from './core/recordSync';
import { addDays, todayISO } from './core/time';
import { DAY_PREFIX } from './dayStore';
import { useDiagnosticsStore } from './diagnosticsStore';
import { ENTITY_PREFIX, isPersistedEntities, useEntityCache } from './entities/cache';
import { isPersistedCity, isPersistedDayRecord } from './entities/validation';
import { FORECAST_PREFIX, restoreForecasts } from './forecastStore';
import { LOG_PREFIX, restoreLog, useLogStore } from './logStore';
import { importLegacyStore } from './migrateLegacy';
import { useSettingsStore } from './settingsStore';

import type { IdbEntry, Pending, Rehydratable } from './core/types';
import type { DayRecord, ForecastEntry } from './types';

const PERSISTED: [Rehydratable, string][] = [
  [useSettingsStore, 'wl2-settings'],
  [useCityStore, 'wl2-cities'],
  [useAlmanacStore, 'wl2-almanac'],
];

const RECENT_DAYS = 120;

onUpgradeBlocked((blocked) => { useBootStore.setState({ storageBlocked: blocked }); });
const FIRST_DECADE = 1940;

let booting: Promise<void> | null = null;
let history: Promise<void> | null = null;
let historyDone = false;
let unmigrated: IdbEntry[] = [];

const MIGRATE_RETRY_MS = 5000;
const MIGRATE_RETRY_MAX = 12;
const LEGACY_KEYS = ['wl2-entities', 'wl2-forecasts', 'wl2-log', 'wl2-days'];

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
  const cities = Object.values(tables?.city ?? {}).flatMap((c): IdbEntry[] => {
    const raw: unknown = c;
    return isPersistedCity(raw) ? [[`${ENTITY_PREFIX}city:${raw.id}`, raw]] : [];
  });
  const days = Object.values(tables?.dayRecord ?? {}).flatMap((d): IdbEntry[] => {
    const raw: unknown = d;
    return isPersistedDayRecord(raw) ? [[`${ENTITY_PREFIX}dayRecord:${raw.id}`, raw]] : [];
  });
  return [...cities, ...days];
}

async function migrateKvToRecords(): Promise<void> {
  const [entities, forecasts, log, days] = await Promise.all(LEGACY_KEYS.map(async (k) => idbGet(k)));
  if (isAbsent(entities) && isAbsent(forecasts) && isAbsent(log) && isAbsent(days)) { return; }
  const entries = [
    ...entityEntries(entities),
    ...prefixed(FORECAST_PREFIX, stateOf(forecasts, 'forecasts')),
    ...prefixed(LOG_PREFIX, stateOf(log, 'dates')),
    ...prefixed(DAY_PREFIX, stateOf(days, 'days')),
  ];
  try {
    await recordsWriteMissing(entries);
  } catch {
    unmigrated = entries;
    trackChanges(true);
    retryMigration(1);
    return;
  }
  await dropLegacy();
}

async function retryAttempt(): Promise<void> {
  await recordsWriteMissing(unmigrated.filter(([key]) => !changedSinceStart(key)));
  await flushRecords();
  await dropLegacy();
  unmigrated = [];
}

function retryMigration(round: number): void {
  setTimeout(() => {
    void retryAttempt()
      .then(() => { trackChanges(false); })
      .catch((error: unknown) => {
        if (round < MIGRATE_RETRY_MAX) { retryMigration(round + 1); } else { trackChanges(false); noteStorageFault(error); }
      });
  }, MIGRATE_RETRY_MS * round);
}

async function dropLegacy(): Promise<void> {
  await Promise.all(LEGACY_KEYS.map(async (k) => idbDel(k)));
}

async function range(prefix: string, from = '', to = '\uFFFF'): Promise<IdbEntry[]> {
  const rows = await readRange(prefix, from, to);
  if (unmigrated.length === 0) { return rows; }
  const stored = new Set(rows.map(([key]) => key));
  const legacy = unmigrated.flatMap(([key, value]): IdbEntry[] => {
    if (!key.startsWith(prefix)) { return []; }
    if (changedSinceStart(key)) { return []; }
    const id = key.slice(prefix.length);
    return id >= from && id <= to && !stored.has(id) ? [[id, value]] : [];
  });
  return [...rows, ...legacy];
}

function values<T>(rows: IdbEntry[], guard: (v: unknown) => v is T): T[] {
  const valid: T[] = [];
  for (const [, value] of rows) {
    if (guard(value)) { valid.push(value); }
    else { noteFailure('hydrate.invalid-record', 'data.validation-failed'); }
  }
  return valid;
}

async function restoreCore(): Promise<void> {
  const [cities, forecasts, logs] = await Promise.all([
    range(`${ENTITY_PREFIX}city:`),
    range(FORECAST_PREFIX),
    range(LOG_PREFIX),
  ]);
  restore(() => { useEntityCache.getState().hydrate('city', values(cities, isPersistedCity)); });
  restoreForecasts(Object.fromEntries(forecasts.flatMap(([k, v]): [string, ForecastEntry][] => (isForecast(v) ? [[k, v]] : []))));
  restoreLog(Object.fromEntries(logs.flatMap(([k, v]): [string, string[]][] => (isDates(v) ? [[k, v]] : []))));
}

registerRehydration('wl2-cities', async () => {
  await useCityStore.persist.rehydrate();
  if (hydrationFault('wl2-cities') === null) { await restoreCore(); }
});

async function restoreDays(cityId: string, from: string, to: string): Promise<void> {
  const rows = await range(`${ENTITY_PREFIX}dayRecord:${cityId}:`, from, to);
  restore(() => { useEntityCache.getState().hydrate('dayRecord', values(rows, isPersistedDayRecord)); });
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
  const found: DayRecord[] = [];
  await inSequence(chunks, async ({ id, from, to }) => {
    const rows = await range(`${ENTITY_PREFIX}dayRecord:${id}:`, from, to);
    found.push(...values(rows, isPersistedDayRecord));
    await yieldToMain();
  });
  restore(() => { useEntityCache.getState().hydrate('dayRecord', found); });
  historyDone = true;
  useBootStore.setState({ historyReady: true });
}

function ask(): boolean {
  void requestPersistentStorage();
  return true;
}

function keepStorage(): void {
  const logged = () => Object.values(useLogStore.getState().dates).some((d) => (d?.length ?? 0) > 0);
  if (logged()) {
    ask();
    return;
  }
  const stop = useLogStore.subscribe(() => {
    if (logged() && ask()) { stop(); }
  });
}

async function bootStep(run: () => Pending, note: (error: unknown) => void): Promise<void> {
  try {
    await run();
  } catch (error) {
    note(error);
  }
}

async function rehydrateStores(): Promise<void> {
  const failures: AppError[] = [];
  await Promise.all(PERSISTED.map(async ([store, name]) => {
    void Promise.resolve(store.persist.rehydrate()).catch(() => null);
    const result = await waitForHydration(store);
    if (result.status === 'timeout') {
      const fault = hydrationFault(name) ?? new AppError({ code: 'storage.read-failed', messageKey: 'errors.storageRead', retryable: true, op: 'hydrate-timeout' });
      failures.push(fault);
      noteFailure('hydrate', fault.code);
      useDiagnosticsStore.getState().bump('hydrationFailures');
    }
  }));
  if (failures.length > 0) { throw failures[0]; }
}

export function hydrateAll(): Pending {
  booting ??= measure('hydrate', async () => {
    let firstError: AppError | undefined;
    const note = (error: unknown): void => { firstError ??= classify(error); };
    await bootStep(async () => { await importLegacyStore(); }, note);
    await bootStep(migrateKvToRecords, note);
    await bootStep(rehydrateStores, note);
    await bootStep(restoreCore, note);
    await bootStep(restoreRecent, note);
    if (firstError !== undefined) { noteStorageFault(firstError); }
    useBootStore.setState({ hydrated: true, phase: firstError === undefined ? 'ready' : 'degraded' });
    keepStorage();
  });
  return booting;
}

export function whenHistoryReady(): Pending {
  if (historyDone) { return READY; }
  history ??= (async () => {
    await hydrateAll();
    await measure('hydrate-history', restoreHistory);
  })().catch((error: unknown) => {
    history = null;
    noteStorageFault(error);
    throw error;
  });
  return history;
}
