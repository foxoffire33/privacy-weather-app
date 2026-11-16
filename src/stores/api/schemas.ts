import { z } from 'zod';

const cell = z.union([z.number(), z.string(), z.null()]);

export const blockSchema = z.object({ time: z.array(z.string()) }).catchall(z.array(cell));

export const currentSchema = z.object({ time: z.string() }).catchall(cell);

export const weatherSchema = z.object({
  utc_offset_seconds: z.number(),
  timezone: z.string().optional(),
  elevation: z.number().optional(),
  current: currentSchema.optional(),
  hourly: blockSchema.optional(),
  daily: blockSchema.optional(),
  minutely_15: blockSchema.optional(),
});

export const geoResultSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  admin1: z.string().optional(),
  country: z.string().optional(),
});

export const geoSchema = z.object({ results: z.array(z.unknown()).optional() }).loose();
