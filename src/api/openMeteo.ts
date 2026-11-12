import { fetchWeatherApi } from 'openmeteo';
import type { AirData, City, DayData, ForecastData, GeoResult, MarineData, Settings } from '../types';
import {
  AIR_VARS, ARCHIVE_DAY_DAILY_VARS, ARCHIVE_HOURLY_VARS, ARCHIVE_VARS, CURRENT_VARS, DAILY_VARS, HOURLY_VARS, MARINE_VARS,
  type AirVar, type CurrentVar, type DailyVar, type HourlyVar, type MarineVar,
} from './variables';

// Weather, air quality, marine and archive use the official SDK (FlatBuffers, built-in retries).
// Geocoding is JSON-only, so it uses fetch. Keyless by default; an API key switches to customer-* hosts.
type Kind = 'forecast' | 'archive' | 'air' | 'marine' | 'geo';
const HOSTS: Record<Kind, [string, string]> = {
  forecast: ['https://api.open-meteo.com', 'https://customer-api.open-meteo.com'],
  archive: ['https://archive-api.open-meteo.com', 'https://customer-archive-api.open-meteo.com'],
  air: ['https://air-quality-api.open-meteo.com', 'https://customer-air-quality-api.open-meteo.com'],
  marine: ['https://marine-api.open-meteo.com', 'https://customer-marine-api.open-meteo.com'],
  geo: ['https://geocoding-api.open-meteo.com', 'https://customer-geocoding-api.open-meteo.com'],
};

function endpoint(kind: Kind, path: string, settings: Settings) {
  let base = HOSTS[kind][settings.apiKey ? 1 : 0];
  if (kind === 'forecast' && settings.server) base = settings.server.replace(/\/$/, '');
  return base + path;
}
const withKey = <T extends object>(params: T, s: Settings) => (s.apiKey ? { ...params, apikey: s.apiKey } : params);

type SdkResponse = Awaited<ReturnType<typeof fetchWeatherApi>>[number];
type Block = NonNullable<ReturnType<SdkResponse['hourly']>>;

// SDK times are unix seconds (UTC); shift by the location's offset to get local ISO strings.
const localIso = (sec: number, offset: number) => new Date((sec + offset) * 1000).toISOString().slice(0, 16);
const clean = (v: number | undefined) => (v == null || Number.isNaN(v) ? null : v);

function times(b: Block, offset: number) {
  const out: string[] = [];
  for (let t = Number(b.time()); t < Number(b.timeEnd()); t += b.interval()) out.push(localIso(t, offset));
  return out;
}
function series<K extends string>(b: Block, names: readonly string[], skip: string[] = []) {
  const out = {} as Record<K, (number | null)[]>;
  names.forEach((name, i) => {
    if (skip.includes(name)) return;
    out[name as K] = Array.from(b.variables(i)?.valuesArray() ?? [], (v) => clean(v));
  });
  return out;
}
function point<K extends string>(b: Block, names: readonly string[]) {
  const out = {} as Record<K, number | null>;
  names.forEach((name, i) => { out[name as K] = clean(b.variables(i)?.value()); });
  return out;
}
function instants(b: Block, i: number, offset: number) {
  const v = b.variables(i)!;
  return Array.from({ length: v.valuesInt64Length() }, (_, k) => localIso(Number(v.valuesInt64(k)), offset));
}

export async function fetchForecast(city: City, settings: Settings, pastDays = 1): Promise<ForecastData> {
  const [r] = await fetchWeatherApi(endpoint('forecast', '/v1/forecast', settings), withKey({
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
  }, settings));
  const off = r.utcOffsetSeconds();
  const c = r.current()!;
  const h = r.hourly()!;
  const d = r.daily()!;
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

export async function fetchAirQuality(city: City, settings: Settings): Promise<AirData> {
  const [r] = await fetchWeatherApi(endpoint('air', '/v1/air-quality', settings), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', forecast_days: 2,
    current: [...AIR_VARS],
    hourly: ['european_aqi'],
  }, settings));
  const off = r.utcOffsetSeconds();
  const h = r.hourly()!;
  return {
    current: point<AirVar>(r.current()!, AIR_VARS),
    hourly: { time: times(h, off), aqi: series<'european_aqi'>(h, ['european_aqi']).european_aqi },
  };
}

// Returns null inland (no sea data for the location).
export async function fetchMarine(city: City, settings: Settings): Promise<MarineData | null> {
  const [r] = await fetchWeatherApi(endpoint('marine', '/v1/marine', settings), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', current: [...MARINE_VARS],
  }, settings));
  const current = point<MarineVar>(r.current()!, MARINE_VARS);
  return current.wave_height == null && current.sea_surface_temperature == null ? null : { current };
}

// Daily values for a date range. 'archive' is ERA5 (back to 1940, about 5 days behind);
// 'forecast' covers roughly the last 92 days and carries variables ERA5 lacks, such as UV.
export async function fetchDailyRange(city: City, start: string, end: string, settings: Settings,
  daily: readonly string[], source: 'archive' | 'forecast' = 'archive') {
  const url = source === 'archive' ? endpoint('archive', '/v1/archive', settings) : endpoint('forecast', '/v1/forecast', settings);
  const [r] = await fetchWeatherApi(url, withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', start_date: start, end_date: end, daily: [...daily],
  }, settings));
  const d = r.daily()!;
  return { time: times(d, r.utcOffsetSeconds()).map((t) => t.slice(0, 10)), ...series<string>(d, daily) } as
    { time: string[] } & Record<string, (number | null)[]>;
}

export const fetchArchive = (city: City, start: string, end: string, settings: Settings, daily: readonly string[] = ARCHIVE_VARS) =>
  fetchDailyRange(city, start, end, settings, daily, 'archive');

// Full detail for one past day. Recent days use the forecast API (all variables);
// older days use the ERA5 archive (no UV, rain chance, visibility, CAPE).
export async function fetchDay(city: City, date: string, settings: Settings, recent: boolean): Promise<DayData> {
  const hourly: readonly string[] = recent ? HOURLY_VARS : ARCHIVE_HOURLY_VARS;
  const daily: readonly string[] = recent ? DAILY_VARS : ARCHIVE_DAY_DAILY_VARS;
  const url = recent ? endpoint('forecast', '/v1/forecast', settings) : endpoint('archive', '/v1/archive', settings);
  const [r] = await fetchWeatherApi(url, withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto',
    start_date: date, end_date: date, hourly: [...hourly], daily: [...daily],
  }, settings));
  const off = r.utcOffsetSeconds();
  const h = r.hourly()!;
  const d = r.daily()!;
  const dSeries = series<DailyVar>(d, daily, ['sunrise', 'sunset']);
  const dv = Object.fromEntries(Object.entries(dSeries).map(([k, arr]) => [k, (arr as (number | null)[])[0] ?? null]));
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

export async function fetchAirDay(city: City, date: string, settings: Settings): Promise<DayData['air']> {
  const [r] = await fetchWeatherApi(endpoint('air', '/v1/air-quality', settings), withKey({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', start_date: date, end_date: date, hourly: [...AIR_VARS],
  }, settings));
  const h = r.hourly()!;
  const v = series<AirVar>(h, AIR_VARS);
  return v.european_aqi.some((x) => x != null) ? { time: times(h, r.utcOffsetSeconds()), v } : null;
}

export async function searchCities(name: string, settings: Settings, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = new URLSearchParams(withKey({ name, count: '8', language: 'en', format: 'json' }, settings) as Record<string, string>);
  const res = await fetch(`${endpoint('geo', '/v1/search', settings)}?${q}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.reason || `HTTP ${res.status}`);
  return json.results ?? [];
}
