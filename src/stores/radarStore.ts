import { create } from 'zustand';

import { fetchLandMap, fetchModelRain, fetchRadarFrame, fetchRadarFrames } from './api/remote';
import { noteStorageFault } from './bootStore';
import { AppError, classify } from './core/appError';
import { getConfig, isOffline } from './core/config';
import { afterGesture } from './core/gesture';
import { isRecord, without } from './core/guards';
import { clearRecords, persistMap, readRecord, restore } from './core/recordSync';
import { LAND_VERSION, MODEL_SET_VERSION, RADAR_SET_VERSION, radarKey, sourceId } from './factories/radar';
import { begin, fail, isFresh, isLoading, queryAt, setQuery } from './factory/queryState';
import { radarQueryAfter, settleRadarLoad } from './factory/radarLoad';

import type { RadarLoadSettled } from './factory/radarLoad';
import type { RadarState } from './storeTypes';
import type { City, LandMap, ModelSet, RadarFrame, RadarSet } from './types';

export const RADAR_PREFIX = 'radar:';
export const LAND_PREFIX = 'radarland:';
export const MODEL_PREFIX = 'radarmodel:';
const NO_RADAR_ERROR = new AppError({ code: 'unknown', messageKey: 'radar.noServer', retryable: false });
const RADAR_FRESH_MS = 5 * 60 * 1000;
const MODEL_FRESH_MS = 15 * 60 * 1000;
export const currentRadarSource = (): string => sourceId(getConfig().radarServer, getConfig().mapServer);

const isLand = (v: unknown): v is LandMap => isRecord(v) && v.version === LAND_VERSION && typeof v.cells === 'string';
const isModelSet = (v: unknown): v is ModelSet => isRecord(v) && v.version === MODEL_SET_VERSION && typeof v.fetchedAt === 'number' && Array.isArray(v.frames);
const isRadarSet = (v: unknown): v is RadarSet => isRecord(v) && v.version === RADAR_SET_VERSION && typeof v.fetchedAt === 'number' && Array.isArray(v.frames);

const runs = new Map<string, number>();
let nextRun = 0;
const runOf = (cityId: string): number => {
  const existing = runs.get(cityId);
  if (existing !== undefined) { return existing; }
  const token = ++nextRun;
  runs.set(cityId, token);
  return token;
};
const dropRun = (cityId: string): void => { runs.delete(cityId); };
let generation = 0;
const current = (cityId: string, run: number, gen: number): boolean => runs.get(cityId) === run && generation === gen;

const ofCity = <V>(map: Partial<Record<string, V>>, cityId: string): Partial<Record<string, V>> =>
  Object.fromEntries(Object.entries(map).filter(([key]) => !key.startsWith(`${cityId}:`)));

async function frames(city: City, cell: number, previous: RadarSet | undefined): Promise<RadarFrame[]> {
  const refs = await fetchRadarFrames();
  const reusable = previous?.version === RADAR_SET_VERSION ? previous.frames : [];
  const kept = new Map(reusable.filter((f) => !f.forecast).map((f) => [f.time, f]));
  return Promise.all(refs.map(async (ref) => {
    const cached = ref.forecast ? undefined : kept.get(ref.time);
    return cached ?? fetchRadarFrame(city, ref, cell);
  }));
}

export const useRadarStore = create<RadarState>()((set, get) => {
  async function restoreKey(cityId: string, key: string, run: number, gen: number): Promise<void> {
    if (get().land[key] !== undefined && get().radar[key] !== undefined) { return; }
    const [land, radar, model] = await Promise.all([readRecord(LAND_PREFIX + key), readRecord(RADAR_PREFIX + key), readRecord(MODEL_PREFIX + key)]);
    if (!current(cityId, run, gen)) { return; }
    restore(() => {
      set((s) => ({
        land: s.land[key] === undefined && isLand(land) ? { ...s.land, [key]: land } : s.land,
        radar: s.radar[key] === undefined && isRadarSet(radar) ? { ...s.radar, [key]: radar } : s.radar,
        model: s.model[key] === undefined && isModelSet(model) ? { ...s.model, [key]: model } : s.model,
      }));
    });
  }

  async function landData(city: City, cell: number, key: string): Promise<LandMap> {
    const cached = get().land[key];
    if (cached !== undefined) { return cached; }
    return fetchLandMap(city, cell);
  }

  async function framesData(city: City, cell: number, key: string): Promise<RadarSet> {
    const previous = get().radar[key];
    if (previous?.version === RADAR_SET_VERSION && Date.now() - previous.fetchedAt < RADAR_FRESH_MS) { return previous; }
    const next: RadarSet = { version: RADAR_SET_VERSION, fetchedAt: Date.now(), frames: await frames(city, cell, previous) };
    return next;
  }

  async function modelData(city: City, cell: number, key: string): Promise<ModelSet> {
    const previous = get().model[key];
    if (previous?.version === MODEL_SET_VERSION && Date.now() - previous.fetchedAt < MODEL_FRESH_MS) { return previous; }
    return fetchModelRain(city, cell);
  }

  async function applyResults(key: string, stale: () => boolean, results: Partial<RadarLoadSettled>): Promise<void> {
    const landValue = results.land?.status === 'fulfilled' ? results.land.value : undefined;
    const framesValue = results.frames?.status === 'fulfilled' ? results.frames.value : undefined;
    const modelValue = results.model?.status === 'fulfilled' ? results.model.value : undefined;
    if (landValue === undefined && framesValue === undefined && modelValue === undefined) { return; }
    await afterGesture();
    if (stale()) { return; }
    set((s) => ({
      land: landValue === undefined ? s.land : { ...s.land, [key]: landValue },
      radar: framesValue === undefined ? s.radar : { ...s.radar, [key]: framesValue },
      model: modelValue === undefined ? s.model : { ...s.model, [key]: modelValue },
    }));
  }

  return {
    land: {},
    radar: {},
    model: {},
    queries: {},
    load: async (city, cell) => {
      const source = currentRadarSource();
      const key = radarKey(city.id, cell, source);
      const q = queryAt(get().queries, key);
      if (isLoading(q) || isFresh(q, RADAR_FRESH_MS)) { return; }
      const run = runOf(city.id);
      const gen = generation;
      const stale = (): boolean => !current(city.id, run, gen) || currentRadarSource() !== source;
      set((s) => ({ queries: setQuery(s.queries, key, begin(q)) }));
      try {
        await restoreKey(city.id, key, run, gen);
      } catch (error) {
        if (current(city.id, run, gen)) {
          noteStorageFault(error);
          set((s) => ({ queries: setQuery(s.queries, key, fail(q, classify(error, key))) }));
        }
        return;
      }
      if (stale()) { return; }
      if (getConfig().radarServer.trim() === '') {
        set((s) => ({ queries: setQuery(s.queries, key, fail(q, NO_RADAR_ERROR)) }));
        return;
      }
      if (isOffline()) {
        set((s) => ({ queries: setQuery(s.queries, key, q) }));
        return;
      }
      const optional = modelData(city, cell, key).then(
        (value): PromiseSettledResult<ModelSet> => ({ status: 'fulfilled', value }),
        (error: unknown): PromiseSettledResult<ModelSet> => ({ status: 'rejected', reason: error }),
      );
      const [landResult, framesResult] = await Promise.allSettled([landData(city, cell, key), framesData(city, cell, key)]);
      if (stale()) { return; }
      await applyResults(key, stale, { land: landResult, frames: framesResult });
      if (stale()) { return; }
      const modelResult = await optional;
      if (stale()) { return; }
      const result = settleRadarLoad(landResult, framesResult, modelResult);
      await applyResults(key, stale, { model: modelResult });
      if (stale()) { return; }
      set((s) => ({ queries: setQuery(s.queries, key, radarQueryAfter(q, result)) }));
    },
    retry: (key) => {
      set((s) => ({ queries: without(s.queries, [key]) }));
    },
    drop: (cityId) => {
      dropRun(cityId);
      set((s) => ({ land: ofCity(s.land, cityId), radar: ofCity(s.radar, cityId), model: ofCity(s.model, cityId), queries: without(s.queries, Object.keys(s.queries).filter((key) => key.startsWith(`${cityId}:`))) }));
    },
    clear: () => {
      generation += 1;
      runs.clear();
      restore(() => { set({ land: {}, radar: {}, model: {}, queries: {} }); });
      void clearRecords(LAND_PREFIX).catch(noteStorageFault);
      void clearRecords(RADAR_PREFIX).catch(noteStorageFault);
      void clearRecords(MODEL_PREFIX).catch(noteStorageFault);
    },
  };
});

persistMap(useRadarStore, (s) => s.land, LAND_PREFIX);
persistMap(useRadarStore, (s) => s.radar, RADAR_PREFIX);
persistMap(useRadarStore, (s) => s.model, MODEL_PREFIX);

