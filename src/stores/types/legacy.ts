import type { City, Settings } from './common';
import type { ArchiveYear, DayRecord } from './dayRecord';
import type { DayData, ForecastEntry } from './weather';

export interface LegacyState {
  settings?: Settings;
  cities?: City[];
  onboarded?: boolean;
  forecasts?: Record<string, ForecastEntry>;
  history?: Record<string, Record<string, Omit<DayRecord, 'id' | 'cityId'>>>;
  normals?: Record<string, Record<string, number>>;
  thisDay?: Record<string, ArchiveYear[]>;
  days?: Record<string, DayData>;
}

export interface LegacyEnvelope {
  state?: LegacyState;
  version?: number;
}
