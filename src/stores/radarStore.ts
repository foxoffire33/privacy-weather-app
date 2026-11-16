import { create } from 'zustand';

import { fetchLandMap, fetchRadarFrame, fetchRadarFrames } from './api/remote';
import { getConfig, isOffline } from './core/config';
import { errorMessage } from './core/errors';
import { afterGesture } from './core/gesture';
import { isRecord, without } from './core/guards';
import { clearRecords, persistMap, readRecord, restore } from './core/recordSync';
import { LAND_VERSION } from './factories/radar';
import { begin, fail, isFresh, isLoading, queryAt, setQuery, succeed } from './factory/queryState';

import type { RadarState } from './storeTypes';
import type { City, LandMap, RadarFrame, RadarSet } from './types';

export const RADAR_PREFIX = 'radar:';
export const LAND_PREFIX = 'radarland:';
export const NO_RADAR_SERVER = 'NO_RADAR_SERVER';
const RADAR_FRESH_MS = 5 * 60 * 1000;

const isLand = (v: unknown): v is LandMap => isRecord(v) && v.version === LAND_VERSION && typeof v.cells === 'string';
const isRadarSet = (v: unknown): v is RadarSet => isRecord(v) && typeof v.fetchedAt === 'number' && Array.isArray(v.frames);

const runs = new Map<string, number>();
const runOf = (cityId: string): number => runs.get(cityId) ?? 0;
const bump = (cityId: string): void => { runs.set(cityId, runOf(cityId) + 1); };
let generation = 0;
const current = (cityId: string, run: number, gen: number): boolean => runOf(cityId) === run && generation === gen;

async function frames(city: City, previous: RadarSet | undefined): Promise<RadarFrame[]> {
  const refs = await fetchRadarFrames();
  const kept = new Map((previous?.frames ?? []).filter((f) => !f.forecast).map((f) => [f.time, f]));
  return Promise.all(refs.map(async (ref) => {
    const cached = ref.forecast ? undefined : kept.get(ref.time);
    return cached ?? fetchRadarFrame(city, ref);
  }));
}

export const useRadarStore = create<RadarState>()((set, get) => {
  async function restoreCity(cityId: string): Promise<void> {
    if (get().land[cityId] !== undefined && get().radar[cityId] !== undefined) { return; }
    const [land, radar] = await Promise.all([readRecord(LAND_PREFIX + cityId), readRecord(RADAR_PREFIX + cityId)]);
    restore(() => {
      set((s) => ({
        land: s.land[cityId] === undefined && isLand(land) ? { ...s.land, [cityId]: land } : s.land,
        radar: s.radar[cityId] === undefined && isRadarSet(radar) ? { ...s.radar, [cityId]: radar } : s.radar,
      }));
    });
  }

  async function loadLand(city: City, run: number, gen: number): Promise<void> {
    if (get().land[city.id] !== undefined) { return; }
    const land = await fetchLandMap(city);
    await afterGesture();
    if (current(city.id, run, gen)) { set((s) => ({ land: { ...s.land, [city.id]: land } })); }
  }

  async function loadRadar(city: City, run: number, gen: number): Promise<void> {
    const previous = get().radar[city.id];
    if (previous !== undefined && Date.now() - previous.fetchedAt < RADAR_FRESH_MS) { return; }
    const next: RadarSet = { fetchedAt: Date.now(), frames: await frames(city, previous) };
    await afterGesture();
    if (current(city.id, run, gen)) { set((s) => ({ radar: { ...s.radar, [city.id]: next } })); }
  }

  return {
    land: {},
    radar: {},
    queries: {},
    load: async (city) => {
      const q = queryAt(get().queries, city.id);
      if (isLoading(q) || isFresh(q, RADAR_FRESH_MS)) { return; }
      const run = runOf(city.id);
      const gen = generation;
      set((s) => ({ queries: setQuery(s.queries, city.id, begin(q)) }));
      await restoreCity(city.id);
      if (!current(city.id, run, gen)) { return; }
      if (getConfig().radarServer.trim() === '') {
        set((s) => ({ queries: setQuery(s.queries, city.id, fail(q, NO_RADAR_SERVER)) }));
        return;
      }
      if (isOffline()) {
        set((s) => ({ queries: setQuery(s.queries, city.id, q) }));
        return;
      }
      const [land, radar] = await Promise.allSettled([loadLand(city, run, gen), loadRadar(city, run, gen)]);
      if (!current(city.id, run, gen)) { return; }
      const failed = [land, radar].find((r) => r.status === 'rejected');
      set((s) => ({ queries: setQuery(s.queries, city.id, failed === undefined ? succeed() : fail(q, errorMessage(failed.reason))) }));
    },
    retry: (cityId) => {
      set((s) => ({ queries: without(s.queries, [cityId]) }));
    },
    drop: (cityId) => {
      bump(cityId);
      set((s) => ({ land: without(s.land, [cityId]), radar: without(s.radar, [cityId]), queries: without(s.queries, [cityId]) }));
    },
    clear: () => {
      generation += 1;
      restore(() => { set({ land: {}, radar: {}, queries: {} }); });
      void clearRecords(LAND_PREFIX);
      void clearRecords(RADAR_PREFIX);
    },
  };
});

persistMap(useRadarStore, (s) => s.land, LAND_PREFIX);
persistMap(useRadarStore, (s) => s.radar, RADAR_PREFIX);
