import { t } from '../i18n';

import type { Accent, Backup, BackupDay, City, WindUnit } from '../stores';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCENT_VALUES: ReadonlySet<string> = new Set<Accent>(['green', 'red', 'blue', 'off', 'custom']);
const DAY_FIELDS = ['hi', 'lo', 'feelsHi', 'feelsLo', 'mm', 'snow', 'wind', 'gust', 'sunshine', 'uv', 'code'] as const;

const WIND_UNITS: ReadonlySet<string> = new Set<WindUnit>(['kmh', 'ms', 'mph']);
const isWindUnit = (x: unknown): x is WindUnit => typeof x === 'string' && WIND_UNITS.has(x);
const isAccent = (x: unknown): x is Accent => typeof x === 'string' && ACCENT_VALUES.has(x);
const numOrNull = (x: unknown): number | null => (isNum(x) ? x : null);

function toCity(c: unknown): City | null {
  if (!isObj(c) || !isStr(c.id) || !isStr(c.name) || !isNum(c.lat) || !isNum(c.lon)) { return null; }
  return {
    id: c.id, name: c.name, region: isStr(c.region) ? c.region : '', lat: c.lat, lon: c.lon,
    followedAt: isStr(c.followedAt) && DATE.test(c.followedAt) ? c.followedAt : new Date().toISOString().slice(0, 10),
  };
}

function toBackupDay(date: string, rec: Record<string, unknown>): BackupDay {
  const day: BackupDay = {
    date,
    source: rec.source === 'filled' || rec.source === 'edited' ? rec.source : 'log',
    snapshots: isNum(rec.snapshots) ? rec.snapshots : 0,
  };
  for (const field of DAY_FIELDS) {
    if (field in rec) { day[field] = numOrNull(rec[field]); }
  }
  return day;
}

function parseHistory(raw: unknown): Backup['history'] {
  const history: Backup['history'] = {};
  if (!isObj(raw)) { return history; }
  for (const [cityId, log] of Object.entries(raw)) {
    if (!isObj(log)) { continue; }
    const days: Record<string, BackupDay> = {};
    for (const [date, rec] of Object.entries(log)) {
      if (DATE.test(date) && isObj(rec)) { days[date] = toBackupDay(date, rec); }
    }
    if (Object.keys(days).length > 0) { history[cityId] = days; }
  }
  return history;
}

function parseSettings(raw: unknown): Backup['settings'] {
  const s = isObj(raw) ? raw : {};
  const settings: Backup['settings'] = {};
  if (s.tempUnit === 'C' || s.tempUnit === 'F') { settings.tempUnit = s.tempUnit; }
  if (isWindUnit(s.windUnit)) { settings.windUnit = s.windUnit; }
  if (isNum(s.snapshotMinutes)) { settings.snapshotMinutes = s.snapshotMinutes; }
  if (typeof s.backfill === 'boolean') { settings.backfill = s.backfill; }
  if (typeof s.offline === 'boolean') { settings.offline = s.offline; }
  if (isAccent(s.accent)) { settings.accent = s.accent; }
  if (isStr(s.accentColor) && /^#[0-9a-f]{6}$/i.test(s.accentColor)) { settings.accentColor = s.accentColor; }
  return settings;
}

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error(t('backup.notJson')); }
  if (!isObj(raw)) { throw new Error(t('backup.notBackup')); }
  const cities = (Array.isArray(raw.cities) ? raw.cities : []).map((c) => toCity(c)).filter((c) => c !== null);
  const history = parseHistory(raw.history);
  const settings = parseSettings(raw.settings);
  if (cities.length === 0 && Object.keys(history).length === 0 && Object.keys(settings).length === 0) { throw new Error(t('backup.empty')); }
  return { version: 1, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '', settings, cities, history };
}

export const countDays = (b: Backup): number => Object.values(b.history).reduce((n, log) => n + Object.keys(log).length, 0);

