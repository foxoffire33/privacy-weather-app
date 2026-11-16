import type { blockSchema, currentSchema, weatherSchema } from './schemas';
import type { AIR_VARS, CURRENT_VARS, DAILY_VARS, HOURLY_VARS, MARINE_VARS } from './variables';
import type { z } from 'zod';

export type EndpointKind = 'forecast' | 'archive' | 'air' | 'marine' | 'geo';

export type WeatherJson = z.infer<typeof weatherSchema>;
export type JsonBlock = z.infer<typeof blockSchema>;
export type JsonCurrent = z.infer<typeof currentSchema>;

export type CurrentVar = typeof CURRENT_VARS[number];
export type HourlyVar = typeof HOURLY_VARS[number];
export type DailyVar = Exclude<typeof DAILY_VARS[number], 'sunrise' | 'sunset'>;
export type AirVar = typeof AIR_VARS[number];
export type MarineVar = typeof MARINE_VARS[number];

export interface RangeRows {
  time: string[];
  v: Partial<Record<string, (number | null)[]>>;
}

export interface CacheAges {
  maxAgeMs: number;
  keepMs?: number;
}
