import type { AirVar, CurrentVar, DailyVar, HourlyVar, MarineVar } from './api/variables';

export interface GeoResult {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string;
  country?: string;
}

export interface City {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  followedAt: string; // YYYY-MM-DD
}

type Series<K extends string> = Record<K, (number | null)[]>;

// Units as delivered by Open-Meteo (metric): °C, km/h, mm, cm (snowfall), m (snow depth,
// visibility, freezing level), hPa, %, seconds (durations), J/kg (CAPE), MJ/m² (radiation).
export interface ForecastData {
  elevation: number;
  timezone: string;
  current: { time: string; v: Record<CurrentVar, number | null> };
  hourly: { time: string[]; v: Series<HourlyVar> };
  minutely15: { time: string[]; precipitation: (number | null)[] } | null;
  daily: { time: string[]; sunrise: string[]; sunset: string[]; v: Series<DailyVar> };
}

export interface AirData {
  current: Record<AirVar, number | null>; // µg/m³ (pollutants), grains/m³ (pollen)
  hourly: { time: string[]; aqi: (number | null)[] };
}

export interface MarineData {
  current: Record<MarineVar, number | null>;
}

// A single past day loaded in full: hourly + daily values (+ air quality when available).
export interface DayData {
  date: string;
  source: 'forecast' | 'archive'; // forecast API for the last ~90 days, ERA5 archive before that
  hourly: { time: string[]; v: Partial<Series<HourlyVar>> };
  daily: { sunrise?: string; sunset?: string; v: Partial<Record<DailyVar, number | null>> };
  air: { time: string[]; v: Partial<Series<AirVar>> } | null;
}

export interface ForecastEntry {
  data: ForecastData;
  air: AirData | null;
  marine: MarineData | null;
  pastDays: number; // index of "today" in daily arrays
  fetchedAt: number;
}

export interface DayRecord {
  date: string;
  hi: number | null;
  lo: number | null;
  feelsHi?: number | null;
  feelsLo?: number | null;
  mm: number | null;
  snow?: number | null;
  wind: number | null;
  gust?: number | null;
  sunshine?: number | null; // seconds
  uv?: number | null;
  code: number | null;
  source: 'log' | 'filled';
  snapshots: number;
}

export interface ArchiveYear { year: number; hi?: number; lo?: number; mm?: number; error?: boolean }

export interface Lookup { loading?: boolean; error?: string; hi?: number; lo?: number; mm?: number; wind?: number; code?: number }

export type Accent = 'red' | 'blue' | 'green' | 'off';
export type TempUnit = 'C' | 'F';
export type WindUnit = 'kmh' | 'ms' | 'mph';

export interface Settings {
  apiKey: string;
  server: string;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  snapshotMinutes: number;
  backfill: boolean;
  accent: Accent;
}

export type Route =
  | { name: 'home' }
  | { name: 'cities' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'history'; cityId: string }
  | { name: 'hourly'; cityId: string }
  | { name: 'day'; cityId: string; date: string };
