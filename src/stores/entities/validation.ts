import { z } from 'zod';

import type { City, DayRecord } from '../types';

const calendarDate = z.iso.date();
const measurement = z.number().nullable().optional();
const nonNegativeMeasurement = z.number().nonnegative().nullable().optional();

export const citySchema: z.ZodType<City> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  followedAt: calendarDate,
});

export const dayRecordSchema: z.ZodType<DayRecord> = z.object({
  id: z.string().min(1),
  cityId: z.string().min(1),
  date: calendarDate,
  source: z.enum(['log', 'filled', 'edited']),
  snapshots: z.number().int().nonnegative(),
  hi: measurement,
  lo: measurement,
  feelsHi: measurement,
  feelsLo: measurement,
  mm: nonNegativeMeasurement,
  snow: nonNegativeMeasurement,
  wind: nonNegativeMeasurement,
  gust: nonNegativeMeasurement,
  sunshine: nonNegativeMeasurement,
  uv: nonNegativeMeasurement,
  code: z.number().int().min(0).max(99).nullable().optional(),
}).refine((record) => record.id === `${record.cityId}:${record.date}`, 'day record identity does not match city/date');

export const isPersistedCity = (value: unknown): value is City => citySchema.safeParse(value).success;
export const isPersistedDayRecord = (value: unknown): value is DayRecord => dayRecordSchema.safeParse(value).success;
