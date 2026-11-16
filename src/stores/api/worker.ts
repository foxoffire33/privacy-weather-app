import { expose } from 'comlink';

import { configureDataLayer } from '../core/config';

import { fetchAirDay, fetchAirQuality, fetchArchive, fetchDailyRange, fetchDay, fetchForecast, fetchMarine, fetchModelRain } from './openMeteo';
import { fetchLandMap, fetchRadarFrame, fetchRadarFrames } from './radar';

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
  fetchModelRain,
  fetchLandMap,
  fetchRadarFrame,
  fetchRadarFrames,
};

export type WorkerApi = typeof api;

expose(api);
