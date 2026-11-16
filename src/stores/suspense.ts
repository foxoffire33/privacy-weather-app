import { use } from 'react';

import { lastSettled } from './core/inflight';
import { cellOfKey, radarKey, sourceId } from './factories/radar';
import { hydrateAll, whenHistoryReady } from './hydration';
import { useCity, useDay, useIsOffline, useLandMap, useMapServer, useModelSet, useRadarQuery, useRadarShownKey, useRadarServer, useRadarSet, useDayQuery, useForecast, useForecastQuery, useLookup, useThisDay } from './selectors';
import { lookupDate, openDay, loadRadar, loadThisDay, refreshCity, resourceKey } from './weatherSync';

import type { ArchiveYear, DayData, ForecastEntry, LookupView, RadarView } from './types';

export function useHydration(): void {
  use(hydrateAll());
}

export function useHistoryReady(): void {
  use(whenHistoryReady());
}

export function useForecastData(cityId: string): ForecastEntry | undefined {
  const city = useCity(cityId);
  const entry = useForecast(cityId);
  const query = useForecastQuery(cityId);
  use(city !== undefined && entry === undefined && query.status !== 'error' ? refreshCity(cityId, { maxAgeMs: 0 }) : lastSettled(resourceKey.forecast(cityId)));
  return entry;
}

export function useDayData(cityId: string, date: string, suspend = true): DayData | undefined {
  const city = useCity(cityId);
  const day = useDay(cityId, date);
  const query = useDayQuery(cityId, date);
  use(suspend && city !== undefined && day === undefined && query.status !== 'error' ? openDay(cityId, date) : lastSettled(resourceKey.day(cityId, date)));
  return day;
}

export function useThisDayData(cityId: string, date: string): ArchiveYear[] | undefined {
  const city = useCity(cityId);
  const years = useThisDay(cityId, date);
  use(city !== undefined && years === undefined ? loadThisDay(cityId, date) : lastSettled(resourceKey.thisDay(cityId, date)));
  return years;
}

export function useLookupData(cityId: string, date: string): LookupView {
  const city = useCity(cityId);
  const lookup = useLookup(cityId, date);
  use(city !== undefined && date !== '' && lookup.record === undefined && lookup.query.status !== 'error' ? lookupDate(cityId, date) : lastSettled(resourceKey.lookup(cityId, date)));
  return lookup;
}

export function useRadarData(cityId: string, cell: number): RadarView {
  const server = useRadarServer();
  const mapServer = useMapServer();
  const source = sourceId(server, mapServer);
  const key = radarKey(cityId, cell, source);
  const shownKey = useRadarShownKey(cityId, cell, source);
  const city = useCity(cityId);
  const land = useLandMap(shownKey);
  const radar = useRadarSet(shownKey);
  const model = useModelSet(shownKey);
  const query = useRadarQuery(key);
  const offline = useIsOffline();
  const empty = land === undefined && radar === undefined;
  use(city !== undefined && empty && server !== '' && !offline && query.status === 'idle' ? loadRadar(cityId, cell) : lastSettled(resourceKey.radar(cityId, cell, key)));
  return { key, land, radar, model, query, shownCell: cellOfKey(shownKey, cell) };
}
