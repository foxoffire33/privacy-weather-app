import { addDays, todayISO } from '../core/time';
import { createAir, createAirDay, createDayData, createForecast, createGeoResults, createMarine, createRangeRows, parseWeather } from '../factories/weather';

import { cachedJson, getJson } from './client';
import { AIR_VARS, ARCHIVE_DAY_DAILY_VARS, ARCHIVE_HOURLY_VARS, ARCHIVE_VARS, CURRENT_VARS, DAILY_VARS, HOURLY_VARS, MARINE_VARS } from './variables';

import type { DateSpan } from '../storeTypes';
import type { AirData, City, DayData, ForecastData, GeoResult, MarineData } from '../types';
import type { RangeRows } from './types';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FOREVER = Number.MAX_SAFE_INTEGER;
const ARCHIVE_SETTLED_DAYS = 5;

const at = (city: City) => ({ latitude: city.lat, longitude: city.lon, timezone: 'auto' });

const settled = (end: string) => end < addDays(todayISO(), -ARCHIVE_SETTLED_DAYS);

export async function fetchForecast(city: City, pastDays = 1, maxAgeMs = 0): Promise<ForecastData> {
  return cachedJson('forecast', '/v1/forecast', {
    ...at(city),
    forecast_days: 7,
    past_days: pastDays,
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    minutely_15: ['precipitation'],
    forecast_minutely_15: 13,
  }, { maxAgeMs, keepMs: 30 * MINUTE, build: (json) => createForecast(parseWeather(json), { current: CURRENT_VARS, hourly: HOURLY_VARS, daily: DAILY_VARS }) });
}

export async function fetchAirQuality(city: City, maxAgeMs = 0): Promise<AirData> {
  return cachedJson('air', '/v1/air-quality', {
    ...at(city), forecast_days: 2, current: AIR_VARS, hourly: ['european_aqi'],
  }, { maxAgeMs, keepMs: 30 * MINUTE, build: (json) => createAir(parseWeather(json), AIR_VARS) });
}

export async function fetchMarine(city: City, maxAgeMs = 0): Promise<MarineData | null> {
  return cachedJson('marine', '/v1/marine', { ...at(city), current: MARINE_VARS }, { maxAgeMs, keepMs: 30 * MINUTE, build: (json) => createMarine(parseWeather(json), MARINE_VARS) });
}

export async function fetchDailyRange(city: City, span: DateSpan, daily: readonly string[],
  source: 'archive' | 'forecast' = 'archive'): Promise<RangeRows> {
  const { from: start, to: end } = span;
  const params = { ...at(city), start_date: start, end_date: end, daily };
  const build = (json: unknown) => createRangeRows(parseWeather(json), daily);
  return source === 'archive'
    ? cachedJson('archive', '/v1/archive', params, { maxAgeMs: settled(end) ? FOREVER : HOUR, build })
    : cachedJson('forecast', '/v1/forecast', params, { maxAgeMs: HOUR, build });
}

export const fetchArchive = async (city: City, start: string, end: string, daily: readonly string[] = ARCHIVE_VARS): Promise<RangeRows> =>
  fetchDailyRange(city, { from: start, to: end }, daily, 'archive');

export async function fetchDay(city: City, date: string, recent: boolean): Promise<DayData> {
  const hourly: readonly string[] = recent ? HOURLY_VARS : ARCHIVE_HOURLY_VARS;
  const daily: readonly string[] = recent ? DAILY_VARS : ARCHIVE_DAY_DAILY_VARS;
  const params = { ...at(city), start_date: date, end_date: date, hourly, daily };
  const build = (json: unknown) => createDayData(parseWeather(json), date, recent, { hourly, daily });
  return recent
    ? cachedJson('forecast', '/v1/forecast', params, { maxAgeMs: settled(date) ? DAY : HOUR, build })
    : cachedJson('archive', '/v1/archive', params, { maxAgeMs: FOREVER, build });
}

export async function fetchAirDay(city: City, date: string): Promise<DayData['air']> {
  return cachedJson('air', '/v1/air-quality', {
    ...at(city), start_date: date, end_date: date, hourly: AIR_VARS,
  }, { maxAgeMs: settled(date) ? FOREVER : HOUR, build: (json) => createAirDay(parseWeather(json), AIR_VARS) });
}

export async function searchCities(name: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const json = await getJson('geo', '/v1/search', { name, count: '8', language: 'en', format: 'json' }, signal);
  return createGeoResults(json);
}
