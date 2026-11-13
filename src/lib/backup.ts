import { t } from '../i18n';

import type { Backup, BackupDay,  City, Settings } from '../stores';




const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error(t('backup.notJson')); }
  if (!isObj(raw)) {throw new Error(t('backup.notBackup'));}
  const cities = (Array.isArray(raw.cities) ? raw.cities : []).filter(
    (c): c is City => isObj(c) && isStr(c.id) && isStr(c.name) && isNum(c.lat) && isNum(c.lon),
  ).map((c) => ({ id: c.id, name: c.name, region: isStr(c.region) ? c.region : '', lat: c.lat, lon: c.lon, followedAt: isStr(c.followedAt) && DATE.test(c.followedAt) ? c.followedAt : new Date().toISOString().slice(0, 10) }));
  const history: Backup['history'] = {};
  if (isObj(raw.history)) {
    for (const [cityId, log] of Object.entries(raw.history)) {
      if (!isObj(log)) {continue;}
      const days: Record<string, BackupDay> = {};
      for (const [date, rec] of Object.entries(log)) {
        if (DATE.test(date) && isObj(rec)) {days[date] = { ...(rec as unknown as BackupDay), date };}
      }
      if (Object.keys(days).length > 0) {history[cityId] = days;}
    }
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Backup['settings'] = {};
  if (s.tempUnit === 'C' || s.tempUnit === 'F') {settings.tempUnit = s.tempUnit;}
  if (s.windUnit === 'kmh' || s.windUnit === 'ms' || s.windUnit === 'mph') {settings.windUnit = s.windUnit;}
  if (isNum(s.snapshotMinutes)) {settings.snapshotMinutes = s.snapshotMinutes;}
  if (typeof s.backfill === 'boolean') {settings.backfill = s.backfill;}
  if (['green', 'red', 'blue', 'off', 'custom'].includes(s.accent as string)) {settings.accent = s.accent as Settings['accent'];}
  if (isStr(s.accentColor) && /^#[0-9a-f]{6}$/i.test(s.accentColor)) {settings.accentColor = s.accentColor;}
  if (cities.length === 0 && Object.keys(history).length === 0 && Object.keys(settings).length === 0) {throw new Error(t('backup.empty'));}
  return { version: 1, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '', settings, cities, history };
}

export const countDays = (b: Backup) => Object.values(b.history).reduce((n, log) => n + Object.keys(log).length, 0);

export {type BackupParts, type Backup} from '../stores';