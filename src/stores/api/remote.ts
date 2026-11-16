import { wrap } from 'comlink';

import { onConfigure } from '../core/config';

import * as direct from './openMeteo';
import OpenMeteoWorker from './worker?worker';

import type { WorkerApi } from './worker';
import type { Remote } from 'comlink';

let proxy: Remote<WorkerApi> | null | undefined;
let failed: Promise<never> | null = null;
let broken = false;

function start(): Remote<WorkerApi> | null {
  if (typeof Worker === 'undefined') { return null; }
  try {
    const worker = new OpenMeteoWorker({ name: 'open-meteo' });
    const remote = wrap<WorkerApi>(worker);
    failed = new Promise<never>((_, reject) => {
      worker.addEventListener('error', (event) => {
        event.preventDefault();
        proxy = null;
        broken = true;
        worker.terminate();
        reject(new Error('worker failed'));
      }, { once: true });
    });
    failed.catch(() => null);
    onConfigure(({ apiKey, server, offline }) => {
      if (!broken) { void remote.configure({ apiKey, server, offline }).catch(() => null); }
    });
    return remote;
  } catch {
    return null;
  }
}

async function call<T>(viaWorker: (api: Remote<WorkerApi>) => Promise<T>, viaDirect: () => Promise<T>): Promise<T> {
  if (proxy === undefined) { proxy = start(); }
  if (proxy === null || failed === null) { return viaDirect(); }
  try {
    return await Promise.race([viaWorker(proxy), failed]);
  } catch (error) {
    if (!broken) { throw error; }
    return viaDirect();
  }
}

export const fetchForecast: typeof direct.fetchForecast = async (...args) => call(async (w) => w.fetchForecast(...args), async () => direct.fetchForecast(...args));
export const fetchAirQuality: typeof direct.fetchAirQuality = async (...args) => call(async (w) => w.fetchAirQuality(...args), async () => direct.fetchAirQuality(...args));
export const fetchMarine: typeof direct.fetchMarine = async (...args) => call(async (w) => w.fetchMarine(...args), async () => direct.fetchMarine(...args));
export const fetchDailyRange: typeof direct.fetchDailyRange = async (...args) => call(async (w) => w.fetchDailyRange(...args), async () => direct.fetchDailyRange(...args));
export const fetchArchive: typeof direct.fetchArchive = async (...args) => call(async (w) => w.fetchArchive(...args), async () => direct.fetchArchive(...args));
export const fetchDay: typeof direct.fetchDay = async (...args) => call(async (w) => w.fetchDay(...args), async () => direct.fetchDay(...args));
export const fetchAirDay: typeof direct.fetchAirDay = async (...args) => call(async (w) => w.fetchAirDay(...args), async () => direct.fetchAirDay(...args));
