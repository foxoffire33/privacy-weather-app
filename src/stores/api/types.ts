import type { AIR_VARS, CURRENT_VARS, DAILY_VARS, HOURLY_VARS, MARINE_VARS } from './variables';
import type { fetchWeatherApi } from 'openmeteo';

export type EndpointKind = 'forecast' | 'archive' | 'air' | 'marine' | 'geo';

export type SdkResponse = Awaited<ReturnType<typeof fetchWeatherApi>>[number];
export type SdkBlock = NonNullable<ReturnType<SdkResponse['hourly']>>;

export type CurrentVar = typeof CURRENT_VARS[number];
export type HourlyVar = typeof HOURLY_VARS[number];
export type DailyVar = Exclude<typeof DAILY_VARS[number], 'sunrise' | 'sunset'>;
export type AirVar = typeof AIR_VARS[number];
export type MarineVar = typeof MARINE_VARS[number];

export interface TimeRows {
  time: string[];
}

export type RangeRows = TimeRows & Partial<Record<string, (number | null)[]>>;
