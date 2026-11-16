import { create } from 'zustand';

import { fetchLandMap, fetchModelRain, fetchRadarFrame, fetchRadarFrames } from './api/remote';
import { getConfig, isOffline } from './core/config';
import { errorMessage } from './core/errors';
import { afterGesture } from './core/gesture';
import { isRecord, without } from './core/guards';
import { clearRecords, persistMap, readRecord, restore } from './core/recordSync';
import { LAND_VERSION, MODEL_SET_VERSION, RADAR_SET_VERSION, radarKey, sourceId } from './factories/radar';
import { begin, fail, isFresh, isLoading, queryAt, setQuery, succeed } from './factory/queryState';

import type { QueryState } from './core/types';
import type { RadarState } from './storeTypes';
import type { City, LandMap, ModelSet, RadarFrame, RadarSet } from './types';

export const RADAR_PREFIX = 'radar:';
export const LAND_PREFIX = 'radarland:';
export const MODEL_PREFIX = 'radarmodel:';
export const NO_RADAR_SERVER = 'NO_RADAR_SERVER';
const RADAR_FRESH_MS = 5 * 60 * 1000;
const MODEL_FRESH_MS = 15 * 60 * 1000;
export const currentRadarSource = (): string => sourceId(getConfig().radarServer, getConfig().mapServer);

const isLand = (v: unknown): v is LandMap => isRecord(v) && v.version === LAND_VERSION && typeof v.cells === 'string';
const isModelSet = (v: unknown): v is ModelSet => isRecord(v) && v.version === MODEL_SET_VERSION && typeof v.fetchedAt === 'number' && Array.isArray(v.frames);
const isRadarSet = (v: unknown): v is RadarSet => isRecord(v) && v.version === RADAR_SET_VERSION && typeof v.fetchedAt === 'number' && Array.isArray(v.frames);

const runs = new Map<string, number>();
const runOf = (cityId: string): number => runs.get(cityId) ?? 0;
const bump = (cityId: string): void => { runs.set(cityId, runOf(cityId) + 1); };
let generation = 0;
const current = (cityId: string, run: number, gen: number): boolean => runOf(cityId) === run && generation === gen;

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

  async function loadLand(city: City, cell: number, run: number, gen: number): Promise<void> {
    const key = radarKey(city.id, cell, currentRadarSource());
    if (get().land[key] !== undefined) { return; }
    const land = await fetchLandMap(city, cell);
    await afterGesture();
    if (current(city.id, run, gen)) { set((s) => ({ land: { ...s.land, [key]: land } })); }
  }

  async function loadFrames(city: City, cell: number, run: number, gen: number): Promise<void> {
    const key = radarKey(city.id, cell, currentRadarSource());
    const previous = get().radar[key];
    if (previous?.version === RADAR_SET_VERSION && Date.now() - previous.fetchedAt < RADAR_FRESH_MS) { return; }
    const next: RadarSet = { version: RADAR_SET_VERSION, fetchedAt: Date.now(), frames: await frames(city, cell, previous) };
    await afterGesture();
    if (current(city.id, run, gen)) { set((s) => ({ radar: { ...s.radar, [key]: next } })); }
  }

  async function loadModel(city: City, cell: number, run: number, gen: number): Promise<void> {
    const key = radarKey(city.id, cell, currentRadarSource());
    const previous = get().model[key];
    if (previous?.version === MODEL_SET_VERSION && Date.now() - previous.fetchedAt < MODEL_FRESH_MS) { return; }
    const next = await fetchModelRain(city, cell);
    await afterGesture();
    if (current(city.id, run, gen)) { set((s) => ({ model: { ...s.model, [key]: next } })); }
  }

  return {
    land: {},
    radar: {},
    model: {},
    queries: {},
    load: async (city, cell) => {
      const key = radarKey(city.id, cell, currentRadarSource());
      const q = queryAt(get().queries, key);
      if (isLoading(q) || isFresh(q, RADAR_FRESH_MS)) { return; }
      const run = runOf(city.id);
      const gen = generation;
      set((s) => ({ queries: setQuery(s.queries, key, begin(q)) }));
      await restoreKey(city.id, key, run, gen);
      if (!current(city.id, run, gen)) { return; }
      if (getConfig().radarServer.trim() === '') {
        set((s) => ({ queries: setQuery(s.queries, key, fail(q, NO_RADAR_SERVER)) }));
        return;
      }
      if (isOffline()) {
        set((s) => ({ queries: setQuery(s.queries, key, q) }));
        return;
      }
      const [land, radar] = await Promise.allSettled([loadLand(city, cell, run, gen), loadFrames(city, cell, run, gen), loadModel(city, cell, run, gen)]);
      if (!current(city.id, run, gen)) { return; }
      const failed = [land, radar].find((r) => r.status === 'rejected');
      const loadedAt = get().radar[key]?.fetchedAt ?? Date.now();
      const done: QueryState = failed === undefined ? { ...succeed(), lastLoadedAt: loadedAt } : fail(q, errorMessage(failed.reason));
      set((s) => ({ queries: setQuery(s.queries, key, done) }));
    },
    retry: (key) => {
      set((s) => ({ queries: without(s.queries, [key]) }));
    },
    drop: (cityId) => {
      bump(cityId);
      set((s) => ({ land: ofCity(s.land, cityId), radar: ofCity(s.radar, cityId), model: ofCity(s.model, cityId), queries: without(s.queries, Object.keys(s.queries).filter((key) => key.startsWith(`${cityId}:`))) }));
    },
    clear: () => {
      generation += 1;
      restore(() => { set({ land: {}, radar: {}, model: {}, queries: {} }); });
      void clearRecords(LAND_PREFIX);
      void clearRecords(RADAR_PREFIX);
      void clearRecords(MODEL_PREFIX);
    },
  };
});

persistMap(useRadarStore, (s) => s.land, LAND_PREFIX);
persistMap(useRadarStore, (s) => s.radar, RADAR_PREFIX);
persistMap(useRadarStore, (s) => s.model, MODEL_PREFIX);

