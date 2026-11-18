import { create } from 'zustand';

import { fetchAirDay, fetchDay } from './api/remote';
import { noteStorageFault } from './bootStore';
import { classify } from './core/appError';
import { isOffline } from './core/config';
import { afterGesture } from './core/gesture';
import { isRecord } from './core/guards';
import { isStorageError } from './core/idb';
import { clearRecords, persistMap, readRecord, restore } from './core/recordSync';
import { daysBetween, todayISO } from './core/time';
import { dayKey } from './entities/schema';
import { FACTORY_VERSION } from './factories/weather';
import { begin, isLoading, queryAt, setQuery, settleError, succeed } from './factory/queryState';

import type { DayState } from './storeTypes';
import type { City, DayData } from './types';

export const DAY_PREFIX = 'day:';

function isDayData(value: unknown): value is DayData {
  return isRecord(value) && typeof value.date === 'string' && isRecord(value.hourly) && isRecord(value.daily);
}

async function download(city: City, date: string): Promise<DayData> {
  const recent = daysBetween(date, todayISO()) <= 90;
  const [day, air] = await Promise.all([
    fetchDay(city, date, recent),
    fetchAirDay(city, date).catch(() => null),
  ]);
  return { ...day, air };
}

let generation = 0;

export const useDayStore = create<DayState>()((set, get) => ({
  days: {},
  queries: {},
  load: async (city, date) => {
    const key = dayKey(city.id, date);
    if (get().days[key] !== undefined || isLoading(get().queries[key])) { return null; }
    set((s) => ({ queries: setQuery(s.queries, key, begin(queryAt(s.queries, key))) }));
    const epoch = generation;
    try {
      const stored = await readRecord(DAY_PREFIX + key);
      if (epoch !== generation) { return null; }
      if (isDayData(stored)) {
        restore(() => { set((s) => ({ days: { ...s.days, [key]: stored }, queries: setQuery(s.queries, key, succeed()) })); });
        if (stored.version !== FACTORY_VERSION && !isOffline()) {
          void download(city, date).then(async (fresh) => {
            await afterGesture();
            if (epoch !== generation) { return; }
            set((s) => ({ days: { ...s.days, [key]: fresh } }));
          }).catch(() => null);
        }
        return stored;
      }
      const full = await download(city, date);
      if (epoch !== generation) { return null; }
      set((s) => ({ days: { ...s.days, [key]: full }, queries: setQuery(s.queries, key, succeed()) }));
      return full;
    } catch (error) {
      if (epoch !== generation) { return null; }
      if (isStorageError(error)) { noteStorageFault(error); }
      const appError = classify(error, key);
      set((s) => ({ queries: setQuery(s.queries, key, settleError(queryAt(s.queries, key), appError)) }));
      return null;
    }
  },
  clear: () => {
    get().clearMemory();
    void clearRecords(DAY_PREFIX).catch(noteStorageFault);
  },
  clearMemory: () => {
    generation += 1;
    restore(() => { set({ days: {}, queries: {} }); });
  },
}));

persistMap(useDayStore, (s) => s.days, DAY_PREFIX);
