import { wrap } from 'comlink';

import { onConfigure } from '../core/config';

import * as direct from './openMeteo';
import OpenMeteoWorker from './worker?worker';

import type { WorkerApi } from './worker';
import type { Remote } from 'comlink';

let proxy: Remote<WorkerApi> | null | undefined;

function start(): Remote<WorkerApi> | null {
  if (typeof Worker === 'undefined') { return null; }
  try {
    const worker = new OpenMeteoWorker({ name: 'open-meteo' });
    const remote = wrap<WorkerApi>(worker);
    worker.addEventListener('error', () => { proxy = null; });
    onConfigure(({ apiKey, server, offline }) => { void remote.configure({ apiKey, server, offline }); });
    return remote;
  } catch {
    return null;
  }
}

function api(): Remote<WorkerApi> | typeof direct {
  proxy ??= start();
  return proxy ?? direct;
}

export const fetchForecast: typeof direct.fetchForecast = async (...args) => api().fetchForecast(...args);
export const fetchAirQuality: typeof direct.fetchAirQuality = async (...args) => api().fetchAirQuality(...args);
export const fetchMarine: typeof direct.fetchMarine = async (...args) => api().fetchMarine(...args);
export const fetchDailyRange: typeof direct.fetchDailyRange = async (...args) => api().fetchDailyRange(...args);
export const fetchArchive: typeof direct.fetchArchive = async (...args) => api().fetchArchive(...args);
export const fetchDay: typeof direct.fetchDay = async (...args) => api().fetchDay(...args);
export const fetchAirDay: typeof direct.fetchAirDay = async (...args) => api().fetchAirDay(...args);
