import { use } from 'react';

import { lastSettled } from './core/inflight';
import { hydrateAll } from './hydration';
import { useCity, useDay, useDayQuery, useForecast, useForecastQuery, useLookup, useThisDay } from './selectors';
import { lookupDate, openDay, loadThisDay, refreshCity, resourceKey } from './weatherSync';

import type { ArchiveYear, DayData, ForecastEntry, LookupView } from './types';

export function useHydration(): void {
  use(hydrateAll());
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
