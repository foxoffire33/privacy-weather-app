import type { AirVar, CurrentVar, DailyVar, HourlyVar, MarineVar } from '../api/variables';

type Series<K extends string> = Record<K, (number | null)[]>;

export interface ForecastData {
  elevation: number;
  timezone: string;
  current: { time: string; v: Record<CurrentVar, number | null> };
  hourly: { time: string[]; v: Series<HourlyVar> };
  minutely15: { time: string[]; precipitation: (number | null)[] } | null;
  daily: { time: string[]; sunrise: string[]; sunset: string[]; v: Series<DailyVar> };
}

export interface AirData {
  current: Record<AirVar, number | null>;
  hourly: { time: string[]; aqi: (number | null)[] };
}

export interface MarineData {
  current: Record<MarineVar, number | null>;
}

export interface DayData {
  date: string;
  source: 'forecast' | 'archive';
  hourly: { time: string[]; v: Partial<Series<HourlyVar>> };
  daily: { sunrise?: string; sunset?: string; v: Partial<Record<DailyVar, number | null>> };
  air: { time: string[]; v: Partial<Series<AirVar>> } | null;
}

export interface ForecastEntry {
  data: ForecastData;
  air: AirData | null;
  marine: MarineData | null;
  pastDays: number;
  fetchedAt: number;
}
