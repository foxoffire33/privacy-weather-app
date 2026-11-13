import type { QueryMap, QueryState } from './core/types';
import type { ArchiveYear, City, DayData, ForecastData, ForecastEntry, GeoResult, Settings } from './types';

export interface ImportCounts { added: number; updated: number; kept: number }

export interface AlmanacState {
  normals: Partial<Record<string, Record<string, number>>>;
  thisDay: Partial<Record<string, ArchiveYear[]>>;
  queries: QueryMap;
  ensureNormals: (city: City) => Promise<void>;
  ensureThisDay: (city: City, date: string) => Promise<void>;
  clear: () => void;
}

export interface CityState {
  cityIds: string[];
  onboarded: boolean;
  follow: (geo: GeoResult) => { id: string; index: number; added: boolean };
  unfollow: (id: string) => void;
  reorder: (from: number, to: number) => void;
  makeDefault: (id: string) => void;
  addMany: (cities: City[]) => string[];
}

export interface DayState {
  days: Partial<Record<string, DayData>>;
  queries: QueryMap;
  load: (city: City, date: string) => Promise<DayData | null>;
  clear: () => void;
}

export interface ForecastState {
  forecasts: Partial<Record<string, ForecastEntry>>;
  queries: QueryMap;
  refresh: (city: City, opts?: { pastDays?: number; maxAgeMs?: number }) => Promise<ForecastEntry | null>;
  drop: (cityId: string) => void;
  clear: () => void;
}

export interface LogState {
  dates: Partial<Record<string, string[]>>;
  queries: QueryMap;
  gapDays: (cityId: string) => number;
  recordForecast: (cityId: string, data: ForecastData, pastDays: number, gap: number) => void;
  logDay: (cityId: string, day: DayData) => void;
  lookup: (city: City, date: string) => Promise<void>;
  addRange: (city: City, start: string, end: string) => Promise<ImportCounts>;
  fillMissing: (city: City, start: string, end: string) => Promise<ImportCounts>;
  removeDay: (cityId: string, date: string) => void;
  addDates: (cityId: string, dates: string[]) => number;
  clear: () => void;
}

export interface SearchState {
  query: string;
  results: GeoResult[];
  request: QueryState;
  setQuery: (q: string) => void;
  run: (q: string) => Promise<void>;
}

export interface SettingsState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

export interface SourceSpan {
  from: string;
  to: string;
  recent: boolean;
}

export interface DateSpan {
  from: string;
  to: string;
}

export interface BootState {
  hydrated: boolean;
}
