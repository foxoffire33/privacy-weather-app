import { z } from 'zod';

import { isRecord } from './core/guards';

import type { Settings } from './types';

export const PUBLIC_RADAR_SERVER = 'https://api.librewxr.net';
export const PUBLIC_MAP_SERVER = 'https://tiles.openfreemap.org/planet';

const httpUrl = z.url().refine((value) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
}, 'unsupported URL scheme');

const sameOriginUrl = z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_~.%-]*$/, 'invalid same-origin path');
const serverUrl = z.union([z.literal(''), httpUrl, sameOriginUrl]);
export const validCustomServer = (value: string): boolean => serverUrl.safeParse(value).success;

export const defaultSettings: Settings = {
  apiKey: '',
  server: '',
  radarServer: PUBLIC_RADAR_SERVER,
  mapServer: PUBLIC_MAP_SERVER,
  tempUnit: 'C',
  windUnit: 'kmh',
  snapshotMinutes: 60,
  backfill: true,
  accent: 'green',
  accentColor: '#178a4a',
  language: 'system',
  offline: false,
};

const fieldSchemas = {
  apiKey: z.string(),
  server: serverUrl,
  radarServer: serverUrl,
  mapServer: serverUrl,
  tempUnit: z.enum(['C', 'F']),
  windUnit: z.enum(['kmh', 'ms', 'mph']),
  snapshotMinutes: z.number().int().min(1).max(1440),
  backfill: z.boolean(),
  accent: z.enum(['green', 'red', 'blue', 'off', 'custom']),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  language: z.enum(['system', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr', 'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']),
  offline: z.boolean(),
};

const settingsSchema = z.object(fieldSchemas);

export function validatePersistedSettings(raw: unknown): { value: Settings; issues: string[] } {
  const whole = settingsSchema.safeParse(raw);
  if (whole.success) {
    return { value: whole.data, issues: [] };
  }
  if (!isRecord(raw)) {
    return { value: { ...defaultSettings }, issues: ['settings: expected an object'] };
  }
  const issues: string[] = [];
  const keep = <T>(key: string, schema: z.ZodType<T>, candidate: unknown, fallback: T): T => {
    if (candidate === undefined) {
      return fallback;
    }
    const parsed = schema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
    issues.push(`${key}: ${parsed.error.issues[0].message}`);
    return fallback;
  };
  return {
    value: {
      apiKey: keep('apiKey', fieldSchemas.apiKey, raw.apiKey, defaultSettings.apiKey),
      server: keep('server', fieldSchemas.server, raw.server, defaultSettings.server),
      radarServer: keep('radarServer', fieldSchemas.radarServer, raw.radarServer, defaultSettings.radarServer),
      mapServer: keep('mapServer', fieldSchemas.mapServer, raw.mapServer, defaultSettings.mapServer),
      tempUnit: keep('tempUnit', fieldSchemas.tempUnit, raw.tempUnit, defaultSettings.tempUnit),
      windUnit: keep('windUnit', fieldSchemas.windUnit, raw.windUnit, defaultSettings.windUnit),
      snapshotMinutes: keep('snapshotMinutes', fieldSchemas.snapshotMinutes, raw.snapshotMinutes, defaultSettings.snapshotMinutes),
      backfill: keep('backfill', fieldSchemas.backfill, raw.backfill, defaultSettings.backfill),
      accent: keep('accent', fieldSchemas.accent, raw.accent, defaultSettings.accent),
      accentColor: keep('accentColor', fieldSchemas.accentColor, raw.accentColor, defaultSettings.accentColor),
      language: keep('language', fieldSchemas.language, raw.language, defaultSettings.language),
      offline: keep('offline', fieldSchemas.offline, raw.offline, defaultSettings.offline),
    },
    issues,
  };
}
