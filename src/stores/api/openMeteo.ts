import { fetchWeatherApi } from 'openmeteo';

import { getConfig } from '../core/config';
import { isRecord } from '../core/guards';

import { AIR_VARS, ARCHIVE_DAY_DAILY_VARS, ARCHIVE_HOURLY_VARS, ARCHIVE_VARS, CURRENT_VARS, DAILY_VARS, HOURLY_VARS, MARINE_VARS,  } from './variables';

import type { AirData, City, DayData, ForecastData, GeoResult, MarineData } from '../types';
import type { AirVar, CurrentVar, DailyVar, EndpointKind, HourlyVar, MarineVar, RangeRows, SdkBlock,  } from './types';

const HOSTS: Record<EndpointKind, [string, string]> = {
  forecast: ['https://api.open-meteo.com', 'https://customer-api.open-meteo.com'],
  archive: ['https://archive-api.open-meteo.com', 'https://customer-archive-api.open-meteo.com'],
  air: ['https://air-quality-api.open-meteo.com', 'https://customer-air-quality-api.open-meteo.com'],
  marine: ['https://marine-api.open-meteo.com', 'https://customer-marine-api.open-meteo.com'],
  geo: ['https://geocoding-api.open-meteo.com', 'https://customer-geocoding-api.open-meteo.com'],
};

function endpoint(kind: EndpointKind, path: string) {
  const { apiKey, server } = getConfig();
  let base = HOSTS[kind][apiKey === '' ? 0 : 1];
  if (kind === 'forecast' && (server !== '')) { base = server.replace(/\/$/, ''); }
  return base + path;
}
const withKey = <T extends object>(params: T) => {
  const { apiKey } = getConfig();
  return apiKey === '' ? params : { ...params, apikey: apiKey };
};

const localIso = (sec: number, offset: number) => new Date((sec + offset) * 1000).toISOString().slice(0, 16);
const clean = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? null : v);

function times(b: SdkBlock, offset: number) {
  const out: string[] = [];
  for (let t = Number(b.time()); t < Number(b.timeEnd()); t += b.interval()) { out.push(localIso(t, offset)); }
  return out;
}
function block(b: SdkBlock | null, what: string): SdkBlock {
  if (b === null) { throw new Error(`Open-Meteo response has no ${what} block`); }
  return b;
}
function series<K extends string>(b: SdkBlock, names: readonly string[], skip: readonly string[] = []): Record<K, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const [i, name] of names.entries()) {
    if (!skip.includes(name)) { out[name] = Array.from(b.variables(i)?.valuesArray() ?? [], (v) => clean(v)); }
  }
  return out;
}
function point<K extends string>(b: SdkBlock, names: readonly string[]): Record<K, number | null> {
  const out: Record<string, number | null> = {};
  for (const [i, name] of names.entries()) { out[name] = clean(b.variables(i)?.value()); }
  return out;
}
function instants(b: SdkBlock, i: number, offset: number) {
  const v = b.variables(i);
  if (v === null) { return []; }
  return Array.from({ length: v.valuesInt64Length() }, (_, k) => localIso(Number(v.valuesInt64(k)), offset));
}

export async function fetchForecast(city: City, pastDays = 1): Promise<ForecastData> {
  const [r] = await fetchWeatherApi(endpoint('forecast', '/v1/forecast'), withKey({
    latitude: city.lat,
    longitude: city.lon,
    timezone: 'auto',
    forecast_days: 7,
    past_days: pastDays,
    current: [...CURRENT_VARS],
    hourly: [...HOURLY_VARS],
    daily: [...DAILY_VARS],
    minutely_15: ['precipitation'],
    forecast_minutely_15: 8,
  }));
  const off = r.utcOffsetSeconds();
  const c = block(r.current(), 'current');
  const h = block(r.hourly(), 'hourly');
  const d = block(r.daily(), 'daily');
  const m = r.minutely15();
  return {
    elevation: r.elevation(),
    timezone: r.timezone() ?? '',
    current: { time: localIso(Number(c.time()), off), v: point<CurrentVar>(c, CURRENT_VARS) },
    hourly: { time: times(h, off), v: series<HourlyVar>(h, HOURLY_VARS) },
    minutely15: m ? { time: times(m, off), precipitation: series<'precipitation'>(m, ['precipitation']).precipitation } : null,
    daily: {
      time: times(d, off).map((t) => t.slice(0, 10)),
      sunrise: instants(d, DAILY_VARS.indexOf('sunrise'), off),
      sunset: instants(d, DAILY_VARS.indexOf('sunset'), off),
      v: series<DailyVar>(d, DAILY_VARS, ['sunrise', 'sunset']),
    },
  };
}

export async function fetchAirQuality(city: City): Promise<AirData> {
  const [r] = await fetchWeatherApi(endpoint('air', '/v1/air-quality'), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', forecast_days: 2,
    current: [...AIR_VARS],
    hourly: ['european_aqi'],
  }));
  const off = r.utcOffsetSeconds();
  const h = block(r.hourly(), 'hourly');
  return {
    current: point<AirVar>(block(r.current(), 'current'), AIR_VARS),
    hourly: { time: times(h, off), aqi: series<'european_aqi'>(h, ['european_aqi']).european_aqi },
  };
}

export async function fetchMarine(city: City): Promise<MarineData | null> {
  const [r] = await fetchWeatherApi(endpoint('marine', '/v1/marine'), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', current: [...MARINE_VARS],
  }));
  const current = point<MarineVar>(block(r.current(), 'current'), MARINE_VARS);
  return current.wave_height === null && current.sea_surface_temperature === null ? null : { current };
}

export async function fetchDailyRange(city: City, start: string, end: string,
  daily: readonly string[], source: 'archive' | 'forecast' = 'archive'): Promise<RangeRows> {
  const url = source === 'archive' ? endpoint('archive', '/v1/archive') : endpoint('forecast', '/v1/forecast');
  const [r] = await fetchWeatherApi(url, withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', start_date: start, end_date: end, daily: [...daily],
  }));
  const d = block(r.daily(), 'daily');
  return { time: times(d, r.utcOffsetSeconds()).map((t) => t.slice(0, 10)), v: series<string>(d, daily) };
}

export const fetchArchive = async (city: City, start: string, end: string, daily: readonly string[] = ARCHIVE_VARS): Promise<RangeRows> =>
  fetchDailyRange(city, start, end, daily, 'archive');

export async function fetchDay(city: City, date: string, recent: boolean): Promise<DayData> {
  const hourly: readonly string[] = recent ? HOURLY_VARS : ARCHIVE_HOURLY_VARS;
  const daily: readonly string[] = recent ? DAILY_VARS : ARCHIVE_DAY_DAILY_VARS;
  const url = recent ? endpoint('forecast', '/v1/forecast') : endpoint('archive', '/v1/archive');
  const [r] = await fetchWeatherApi(url, withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto',
    start_date: date, end_date: date, hourly: [...hourly], daily: [...daily],
  }));
  const off = r.utcOffsetSeconds();
  const h = block(r.hourly(), 'hourly');
  const d = block(r.daily(), 'daily');
  const dSeries = series<DailyVar>(d, daily, ['sunrise', 'sunset']);
  const dv = Object.fromEntries(Object.entries(dSeries).map(([k, arr]) => [k, (arr)[0] ?? null]));
  return {
    date,
    source: recent ? 'forecast' : 'archive',
    hourly: { time: times(h, off), v: series<HourlyVar>(h, hourly) },
    daily: {
      sunrise: instants(d, daily.indexOf('sunrise'), off)[0],
      sunset: instants(d, daily.indexOf('sunset'), off)[0],
      v: dv,
    },
    air: null,
  };
}

export async function fetchAirDay(city: City, date: string): Promise<DayData['air']> {
  const [r] = await fetchWeatherApi(endpoint('air', '/v1/air-quality'), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', start_date: date, end_date: date, hourly: [...AIR_VARS],
  }));
  const h = block(r.hourly(), 'hourly');
  const v = series<AirVar>(h, AIR_VARS);
  return v.european_aqi.some((x) => x !== null) ? { time: times(h, r.utcOffsetSeconds()), v } : null;
}

function isGeoResult(x: unknown): x is GeoResult {
  return isRecord(x) && (typeof x.id === 'number' || typeof x.id === 'string') && typeof x.name === 'string'
    && typeof x.latitude === 'number' && typeof x.longitude === 'number';
}

export async function searchCities(name: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = new URLSearchParams(withKey({ name, count: '8', language: 'en', format: 'json' }));
  const doFetch = getConfig().fetch ?? fetch;
  const res = await doFetch(`${endpoint('geo', '/v1/search')}?${q}`, { signal });
  const json: unknown = await res.json().catch(() => ({}));
  const body = isRecord(json) ? json : {};
  if (!res.ok || body.error === true) {
    throw new Error(typeof body.reason === 'string' && body.reason !== '' ? body.reason : `HTTP ${String(res.status)}`);
  }
  return Array.isArray(body.results) ? body.results.filter((g) => isGeoResult(g)) : [];
}
