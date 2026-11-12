import type { City, DayRecord, Settings } from '../types';

// Backup file written by Settings → Export JSON. The API key is never included.
export interface Backup {
  version: 1;
  exportedAt: string;
  settings: Partial<Omit<Settings, 'apiKey'>>;
  cities: City[];
  history: Record<string, Record<string, DayRecord>>;
}

export type BackupParts = { cities: boolean; history: boolean; settings: boolean };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Keeps only what looks right, so a damaged or foreign file cannot corrupt the store.
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!isObj(raw)) throw new Error('This is not a Weather Log backup.');

  const cities = (Array.isArray(raw.cities) ? raw.cities : []).filter(
    (c): c is City => isObj(c) && isStr(c.id) && isStr(c.name) && isNum(c.lat) && isNum(c.lon),
  ).map((c) => ({ id: c.id, name: c.name, region: isStr(c.region) ? c.region : '', lat: c.lat, lon: c.lon, followedAt: isStr(c.followedAt) && DATE.test(c.followedAt) ? c.followedAt : new Date().toISOString().slice(0, 10) }));

  const history: Backup['history'] = {};
  if (isObj(raw.history)) {
    for (const [cityId, log] of Object.entries(raw.history)) {
      if (!isObj(log)) continue;
      const days: Record<string, DayRecord> = {};
      for (const [date, rec] of Object.entries(log)) {
        if (DATE.test(date) && isObj(rec)) days[date] = { ...(rec as unknown as DayRecord), date };
      }
      if (Object.keys(days).length) history[cityId] = days;
    }
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Backup['settings'] = {};
  if (s.tempUnit === 'C' || s.tempUnit === 'F') settings.tempUnit = s.tempUnit;
  if (s.windUnit === 'kmh' || s.windUnit === 'ms' || s.windUnit === 'mph') settings.windUnit = s.windUnit;
  if (isNum(s.snapshotMinutes)) settings.snapshotMinutes = s.snapshotMinutes;
  if (typeof s.backfill === 'boolean') settings.backfill = s.backfill;
  if (['green', 'red', 'blue', 'off', 'custom'].includes(s.accent as string)) settings.accent = s.accent as Settings['accent'];
  if (isStr(s.accentColor) && /^#[0-9a-f]{6}$/i.test(s.accentColor)) settings.accentColor = s.accentColor;

  if (!cities.length && !Object.keys(history).length && !Object.keys(settings).length) throw new Error('No cities, history or settings found in this file.');
  return { version: 1, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '', settings, cities, history };
}

export const countDays = (b: Backup) => Object.values(b.history).reduce((n, log) => n + Object.keys(log).length, 0);
