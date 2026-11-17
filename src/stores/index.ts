import { noteStorageFault } from './bootStore';
import { onRecordFault } from './core/recordSync';

onRecordFault((error) => { noteStorageFault(error); });

export { addDays, daysBetween, todayISO } from './core/time';
export { errorMessage } from './core/errors';
export { IDLE_QUERY } from './core/types';
export type { QueryState } from './core/types';

export { begin, fail, succeed } from './factory/queryState';

export { useEntityCache } from './entities/cache';

export * from './settingsSchema';
export * from './settingsStore';
export * from './cityStore';
export * from './forecastStore';
export * from './logStore';
export * from './dayStore';
export * from './radarStore';
export { DEFAULT_RADAR_CELL, levelOf, RADAR_CELLS, rainRate, VISIBLE_COLS, VISIBLE_ROWS } from './factories/radar';
export * from './almanacStore';
export * from './searchStore';
export * from './weatherSync';
export * from './bootStore';
export * from './diagnosticsStore';
export type * from './storeTypes';
export * from './selectors';
export * from './suspense';
export { lastSettled, latest, once } from './core/inflight';
export { gestureEnd, gestureStart } from './core/gesture';
export { flushRecords } from './core/recordSync';
export { flushPersistedState, persistenceStatus, retryPersistedState } from './core/persistStorage';
export { onMeasure, whenIdle } from './core/marks';
export { whenHistoryReady } from './hydration';

export type * from './types';
export type * from './api/types';
