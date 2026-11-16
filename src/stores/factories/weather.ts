import { geoResultSchema, geoSchema, weatherSchema } from '../api/schemas';
import { isRecord } from '../core/guards';

import type { AirVar, CurrentVar, DailyVar, HourlyVar, JsonBlock, JsonCurrent, MarineVar, RangeRows, WeatherJson } from '../api/types';
import type { AirData, DayData, ForecastData, GeoResult, MarineData } from '../types';

export const FACTORY_VERSION = 2;

const reading = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) { throw new Error(`Open-Meteo response has no ${what} block`); }
  return value;
}

function numbers(block: JsonBlock, name: string): (number | null)[] {
  return Object.hasOwn(block, name) ? block[name].map((v) => reading(v)) : [];
}

function strings(block: JsonBlock, name: string): string[] {
  return Object.hasOwn(block, name) ? block[name].filter((v): v is string => typeof v === 'string') : [];
}

function series<K extends string>(block: JsonBlock, names: readonly string[], skip: readonly string[] = []): Record<K, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const name of names) {
    if (!skip.includes(name)) { out[name] = numbers(block, name); }
  }
  return out;
}

function point<K extends string>(current: JsonCurrent, names: readonly string[]): Record<K, number | null> {
  const out: Record<string, number | null> = {};
  for (const name of names) { out[name] = reading(current[name]); }
  return out;
}

export function parseWeather(json: unknown): WeatherJson {
  return weatherSchema.parse(json);
}

export function createForecast(json: WeatherJson, vars: { current: readonly string[]; hourly: readonly string[]; daily: readonly string[] }): ForecastData {
  const current = need(json.current, 'current');
  const hourly = need(json.hourly, 'hourly');
  const daily = need(json.daily, 'daily');
  const quarter = json.minutely_15;
  return {
    elevation: json.elevation ?? 0,
    timezone: json.timezone ?? '',
    current: { time: current.time, v: point<CurrentVar>(current, vars.current) },
    hourly: { time: hourly.time, v: series<HourlyVar>(hourly, vars.hourly) },
    minutely15: quarter ? { time: quarter.time, precipitation: numbers(quarter, 'precipitation') } : null,
    daily: {
      time: daily.time.map((t) => t.slice(0, 10)),
      sunrise: strings(daily, 'sunrise'),
      sunset: strings(daily, 'sunset'),
      v: series<DailyVar>(daily, vars.daily, ['sunrise', 'sunset']),
    },
  };
}

export function createAir(json: WeatherJson, vars: readonly string[]): AirData {
  const hourly = need(json.hourly, 'hourly');
  return {
    current: point<AirVar>(need(json.current, 'current'), vars),
    hourly: { time: hourly.time, aqi: numbers(hourly, 'european_aqi') },
  };
}

export function createMarine(json: WeatherJson, vars: readonly string[]): MarineData | null {
  const current = point<MarineVar>(need(json.current, 'current'), vars);
  return current.wave_height === null && current.sea_surface_temperature === null ? null : { current };
}

export function createRangeRows(json: WeatherJson, daily: readonly string[]): RangeRows {
  const block = need(json.daily, 'daily');
  return { time: block.time.map((t) => t.slice(0, 10)), v: series<string>(block, daily) };
}

export function createDayData(json: WeatherJson, date: string, recent: boolean, vars: { hourly: readonly string[]; daily: readonly string[] }): DayData {
  const hourly = need(json.hourly, 'hourly');
  const daily = need(json.daily, 'daily');
  const values = series<DailyVar>(daily, vars.daily, ['sunrise', 'sunset']);
  return {
    date,
    source: recent ? 'forecast' : 'archive',
    hourly: { time: hourly.time, v: series<HourlyVar>(hourly, vars.hourly) },
    daily: {
      sunrise: strings(daily, 'sunrise').at(0),
      sunset: strings(daily, 'sunset').at(0),
      v: Object.fromEntries(Object.entries(values).map(([k, arr]) => [k, arr[0] ?? null])),
    },
    air: null,
    version: FACTORY_VERSION,
  };
}

export function createAirDay(json: WeatherJson, vars: readonly string[]): DayData['air'] {
  const hourly = need(json.hourly, 'hourly');
  const v = series<AirVar>(hourly, vars);
  return v.european_aqi.some((x) => x !== null) ? { time: hourly.time, v } : null;
}

export function createGeoResults(json: unknown): GeoResult[] {
  const body = geoSchema.parse(isRecord(json) ? json : {});
  return (body.results ?? []).flatMap((r) => {
    const parsed = geoResultSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}
