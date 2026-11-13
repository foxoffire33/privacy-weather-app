import { dayKey } from '../entities/schema';

import type { DayData, DayRecord, ForecastData } from '../types';
import type { RangeRows } from './types';

export function fromForecastDaily(cityId: string, data: ForecastData, i: number, source: DayRecord['source']): DayRecord {
  const { time, v } = data.daily;
  const date = time[i];
  return {
    id: dayKey(cityId, date),
    cityId,
    date,
    hi: v.temperature_2m_max[i],
    lo: v.temperature_2m_min[i],
    feelsHi: v.apparent_temperature_max[i],
    feelsLo: v.apparent_temperature_min[i],
    mm: v.precipitation_sum[i],
    snow: v.snowfall_sum[i],
    wind: v.wind_speed_10m_max[i],
    gust: v.wind_gusts_10m_max[i],
    sunshine: v.sunshine_duration[i],
    uv: v.uv_index_max[i],
    code: v.weather_code[i],
    source,
    snapshots: 0,
  };
}

export function fromRangeRow(cityId: string, rows: RangeRows, i: number): DayRecord {
  const date = rows.time[i];
  const at = (name: string) => rows[name]?.[i];
  return {
    id: dayKey(cityId, date),
    cityId,
    date,
    hi: at('temperature_2m_max'),
    lo: at('temperature_2m_min'),
    feelsHi: at('apparent_temperature_max'),
    feelsLo: at('apparent_temperature_min'),
    mm: at('precipitation_sum'),
    snow: at('snowfall_sum'),
    wind: at('wind_speed_10m_max'),
    gust: at('wind_gusts_10m_max'),
    sunshine: at('sunshine_duration'),
    uv: at('uv_index_max'),
    code: at('weather_code'),
    source: 'filled',
    snapshots: 0,
  };
}

export function fromDayData(cityId: string, day: DayData): DayRecord {
  const v = day.daily.v;
  return {
    id: dayKey(cityId, day.date),
    cityId,
    date: day.date,
    hi: v.temperature_2m_max,
    lo: v.temperature_2m_min,
    feelsHi: v.apparent_temperature_max,
    feelsLo: v.apparent_temperature_min,
    mm: v.precipitation_sum,
    snow: v.snowfall_sum,
    wind: v.wind_speed_10m_max,
    gust: v.wind_gusts_10m_max,
    sunshine: v.sunshine_duration,
    uv: v.uv_index_max,
    code: v.weather_code,
    source: 'filled',
    snapshots: 0,
  };
}

export const isEmptyRecord = (r: DayRecord): boolean => r.hi == null && r.lo == null && r.mm == null;
