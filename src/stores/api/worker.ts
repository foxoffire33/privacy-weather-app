import { expose } from 'comlink';

import { configureDataLayer } from '../core/config';
import { useDiagnosticsStore } from '../diagnosticsStore';

import { fetchAirDay, fetchAirQuality, fetchArchive, fetchDailyRange, fetchDay, fetchForecast, fetchMarine, fetchModelRain } from './openMeteo';
import { fetchLandMap, fetchRadarFrame, fetchRadarFrames } from './radar';
import { guard } from './workerResult';

import type { WorkerConfig } from '../core/types';

const api = {
  configure: (config: WorkerConfig): void => { configureDataLayer(config); },
  drainDiagnostics: (): { loads: number; cacheHits: number; failures: { name: string; detail: string }[] } => {
    const state = useDiagnosticsStore.getState();
    const result = {
      loads: state.metrics.loads,
      cacheHits: state.metrics.cacheHits,
      failures: state.entries.filter((entry) => entry.kind === 'failure').map(({ name, detail }) => ({ name, detail })),
    };
    state.clear();
    return result;
  },
  fetchAirDay: guard(fetchAirDay),
  fetchAirQuality: guard(fetchAirQuality),
  fetchArchive: guard(fetchArchive),
  fetchDailyRange: guard(fetchDailyRange),
  fetchDay: guard(fetchDay),
  fetchForecast: guard(fetchForecast),
  fetchMarine: guard(fetchMarine),
  fetchModelRain: guard(fetchModelRain),
  fetchLandMap: guard(fetchLandMap),
  fetchRadarFrame: guard(fetchRadarFrame),
  fetchRadarFrames: guard(fetchRadarFrames),
};

export type WorkerApi = typeof api;

expose(api);
