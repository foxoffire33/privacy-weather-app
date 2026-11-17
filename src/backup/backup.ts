import { t } from '../i18n';

import type { Accent, Backup, BackupDay, City, SkippedRecord, WindUnit } from '../stores';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5_000_000;
export const MAX_CITIES = 1000;
export const MAX_DAYS_PER_CITY = 3660;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isVersion = (x: unknown): x is number => isNum(x) && Number.isInteger(x);
const isSnapshotMinutes = (x: unknown): x is number => isNum(x) && Number.isInteger(x) && x >= 1 && x <= 1440;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCENT_VALUES: ReadonlySet<string> = new Set<Accent>(['green', 'red', 'blue', 'off', 'custom']);
const DAY_FIELDS = ['hi', 'lo', 'feelsHi', 'feelsLo', 'mm', 'snow', 'wind', 'gust', 'sunshine', 'uv', 'code'] as const;

const WIND_UNITS: ReadonlySet<string> = new Set<WindUnit>(['kmh', 'ms', 'mph']);
const isWindUnit = (x: unknown): x is WindUnit => typeof x === 'string' && WIND_UNITS.has(x);
const isAccent = (x: unknown): x is Accent => typeof x === 'string' && ACCENT_VALUES.has(x);
const numOrNull = (x: unknown): number | null => (isNum(x) ? x : null);

function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) { return false; }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const cityPath = (index: number): string => `cities[${String(index)}]`;

const hasValidCoords = (c: Record<string, unknown>): c is Record<string, unknown> & { lat: number; lon: number } =>
  isNum(c.lat) && isNum(c.lon) && c.lat >= -90 && c.lat <= 90 && c.lon >= -180 && c.lon <= 180;

function toCity(c: unknown, index: number, seen: Set<string>, skipped: SkippedRecord[]): City | null {
  if (!isObj(c) || !isStr(c.id) || c.id === '') {
    skipped.push({ path: cityPath(index), reason: t('backup.skipCityId') });
    return null;
  }
  if (seen.has(c.id)) {
    skipped.push({ path: cityPath(index), reason: t('backup.skipCityDuplicate') });
    return null;
  }
  if (!isStr(c.name) || c.name === '') {
    skipped.push({ path: cityPath(index), reason: t('backup.skipCityName') });
    return null;
  }
  if (!hasValidCoords(c)) {
    skipped.push({ path: cityPath(index), reason: t('backup.skipCityCoords') });
    return null;
  }
  seen.add(c.id);
  return {
    id: c.id, name: c.name, region: isStr(c.region) ? c.region : '', lat: c.lat, lon: c.lon,
    followedAt: isStr(c.followedAt) && isCalendarDate(c.followedAt) ? c.followedAt : new Date().toISOString().slice(0, 10),
  };
}

function parseCities(raw: unknown, skipped: SkippedRecord[]): City[] {
  const list = Array.isArray(raw) ? raw : [];
  const cities: City[] = [];
  const seen = new Set<string>();
  let capped = false;
  for (const [index, item] of list.entries()) {
    if (cities.length >= MAX_CITIES) {
      if (!capped) {
        capped = true;
        skipped.push({ path: 'cities', reason: t('backup.skipLimit') });
      }
      continue;
    }
    const city = toCity(item, index, seen, skipped);
    if (city !== null) { cities.push(city); }
  }
  return cities;
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

function parseHistory(raw: unknown, knownCities: ReadonlySet<string>, skipped: SkippedRecord[]): Backup['history'] {
  const history: Backup['history'] = {};
  if (!isObj(raw)) { return history; }
  for (const [cityId, log] of Object.entries(raw)) {
    if (!knownCities.has(cityId)) {
      skipped.push({ path: `history.${cityId}`, reason: t('backup.skipUnknownCity') });
      continue;
    }
    if (!isObj(log)) {
      skipped.push({ path: `history.${cityId}`, reason: t('backup.skipNotRecord') });
      continue;
    }
    const days: Record<string, BackupDay> = {};
    let capped = false;
    for (const [date, rec] of Object.entries(log)) {
      if (!isCalendarDate(date)) {
        skipped.push({ path: `history.${cityId}.${date}`, reason: t('backup.skipDayDate') });
        continue;
      }
      if (Object.keys(days).length >= MAX_DAYS_PER_CITY) {
        if (!capped) {
          capped = true;
          skipped.push({ path: `history.${cityId}`, reason: t('backup.skipLimit') });
        }
        continue;
      }
      if (!isObj(rec)) {
        skipped.push({ path: `history.${cityId}.${date}`, reason: t('backup.skipNotRecord') });
        continue;
      }
      days[date] = toBackupDay(date, rec);
    }
    if (Object.keys(days).length > 0) { history[cityId] = days; }
  }
  return history;
}

function parseSettings(raw: unknown, skipped: SkippedRecord[]): Backup['settings'] {
  const s = isObj(raw) ? raw : {};
  const settings: Backup['settings'] = {};
  if (s.tempUnit === 'C' || s.tempUnit === 'F') { settings.tempUnit = s.tempUnit; }
  if (isWindUnit(s.windUnit)) { settings.windUnit = s.windUnit; }
  if (isSnapshotMinutes(s.snapshotMinutes)) { settings.snapshotMinutes = s.snapshotMinutes; }
  else if (s.snapshotMinutes !== undefined) { skipped.push({ path: 'settings.snapshotMinutes', reason: t('backup.skipSetting') }); }
  if (typeof s.backfill === 'boolean') { settings.backfill = s.backfill; }
  if (typeof s.offline === 'boolean') { settings.offline = s.offline; }
  if (isAccent(s.accent)) { settings.accent = s.accent; }
  if (isStr(s.accentColor) && /^#[0-9a-f]{6}$/i.test(s.accentColor)) { settings.accentColor = s.accentColor; }
  return settings;
}

interface Migration {
  from: number;
  run: (raw: Record<string, unknown>) => Record<string, unknown>;
}

const MIGRATIONS: readonly Migration[] = [];

function migrateBackup(raw: Record<string, unknown>, from: number): Record<string, unknown> {
  let current = raw;
  let version = from;
  while (version < BACKUP_VERSION) {
    const source = version;
    const step = MIGRATIONS.find((m) => m.from === source);
    if (step === undefined) {
      throw new Error(t('backup.version'));
    }
    current = step.run(current);
    version += 1;
  }
  return current;
}

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) { throw new Error(t('backup.tooLarge')); }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error(t('backup.notJson')); }
  if (!isObj(raw)) { throw new Error(t('backup.notBackup')); }
  if (!isVersion(raw.version) || raw.version < 1) { throw new Error(t('backup.version')); }
  if (raw.version > BACKUP_VERSION) { throw new Error(t('backup.futureVersion')); }
  const migrated = migrateBackup(raw, raw.version);
  const skipped: SkippedRecord[] = [];
  const cities = parseCities(migrated.cities, skipped);
  const history = parseHistory(migrated.history, new Set(cities.map((c) => c.id)), skipped);
  const settings = parseSettings(migrated.settings, skipped);
  if (cities.length === 0 && Object.keys(history).length === 0 && Object.keys(settings).length === 0) { throw new Error(t('backup.empty')); }
  return { version: BACKUP_VERSION, exportedAt: isStr(migrated.exportedAt) ? migrated.exportedAt : '', settings, cities, history, skipped };
}

export const countDays = (b: Backup): number => Object.values(b.history).reduce((n, log) => n + Object.keys(log).length, 0);

