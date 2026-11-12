import type { StateCreator } from 'zustand';
import type {
  ArchiveYear, City, DayData, DayRecord, ForecastData, ForecastEntry, GeoResult, Lookup, Route, Settings,
} from '../types';

export interface SettingsSlice {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

export interface CitiesSlice {
  cities: City[]; // cities[0] is the default city
  onboarded: boolean;
  followCity: (geo: GeoResult) => number;
  unfollowCity: (id: string) => void;
  reorderCities: (from: number, to: number) => void;
  makeDefault: (id: string) => void;
}

export interface ForecastSlice {
  forecasts: Record<string, ForecastEntry>;
  status: Record<string, { loading: boolean; error: string | null }>;
  refreshCity: (id: string, opts?: { maxAgeMs?: number }) => Promise<void>;
  refreshAll: (opts?: { maxAgeMs?: number }) => Promise<void>;
}

export interface HistorySlice {
  history: Record<string, Record<string, DayRecord>>;
  normals: Record<string, Record<string, number>>;
  thisDay: Record<string, ArchiveYear[]>;
  lookups: Record<string, Lookup>;
  lookupDraft: string;
  days: Record<string, DayData>; // `${cityId}:YYYY-MM-DD`
  dayStatus: Record<string, { loading: boolean; error: string | null }>;
  gapDays: (id: string) => number;
  recordForecast: (id: string, data: ForecastData, pastDays: number, gap: number) => void;
  logYesterday: (id: string) => void;
  logDay: (id: string, date: string) => void;
  loadNormals: (id: string) => Promise<void>;
  loadThisDay: (id: string, date: string) => Promise<void>;
  setLookupDraft: (date: string) => void;
  lookupDate: (id: string, date: string) => Promise<void>;
  loadDay: (id: string, date: string) => Promise<void>;
  clearHistory: () => void;
}

export interface SearchSlice {
  query: string;
  results: GeoResult[];
  searching: boolean;
  searchError: string | null;
  setQuery: (q: string) => void;
  runSearch: (q: string) => Promise<void>;
}

export interface UiSlice {
  hydrated: boolean;
  route: Route;
  stack: Route[];
  pageIndex: number;
  expandedDay: Record<string, string | null>; // cityId -> date of the open daily row
  chartMetric: string;
  historyRange: number; // days, 0 = all
  setHydrated: () => void;
  setChartMetric: (m: string) => void;
  setHistoryRange: (d: number) => void;
  toggleDay: (cityId: string, date: string) => void;
  navigate: (route: Route) => void;
  back: () => void;
  goHome: (pageIndex?: number) => void;
  setPage: (i: number) => void;
}

export type StoreState = SettingsSlice & CitiesSlice & ForecastSlice & HistorySlice & SearchSlice & UiSlice;

export type SliceCreator<T> = StateCreator<StoreState, [['zustand/persist', unknown]], [], T>;
