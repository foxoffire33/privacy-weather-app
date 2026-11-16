import { expose } from 'comlink';

import { configureDataLayer } from '../core/config';

import { fetchAirDay, fetchAirQuality, fetchArchive, fetchDailyRange, fetchDay, fetchForecast, fetchMarine } from './openMeteo';

import type { WorkerConfig } from '../core/types';

const api = {
  configure: (config: WorkerConfig): void => { configureDataLayer(config); },
  fetchAirDay,
  fetchAirQuality,
  fetchArchive,
  fetchDailyRange,
  fetchDay,
  fetchForecast,
  fetchMarine,
};

export type WorkerApi = typeof api;

expose(api);
