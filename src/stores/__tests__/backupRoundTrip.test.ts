import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { dayKey } from '../entities/schema';
import { defaultSettings } from '../settingsSchema';

import type * as Backup from '../../backup/backup';
import type * as CityStore from '../cityStore';
import type * as Cache from '../entities/cache';
import type * as Log from '../logStore';
import type * as SettingsStore from '../settingsStore';
import type { City, DayRecord } from '../types';
import type * as Sync from '../weatherSync';

interface App {
  backup: typeof Backup;
  city: typeof CityStore;
  cache: typeof Cache.entityCache;
  log: typeof Log;
  settings: typeof SettingsStore;
  sync: typeof Sync;
}

async function fresh(): Promise<App> {
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
  vi.resetModules();
  const [backup, city, cacheModule, log, settings, sync] = await Promise.all([
    import('../../backup/backup'),
    import('../cityStore'),
    import('../entities/cache'),
    import('../logStore'),
    import('../settingsStore'),
    import('../weatherSync'),
  ]);
  return { backup, city, cache: cacheModule.entityCache, log, settings, sync };
}

const SEED_CITIES: City[] = [
  { id: 'a', name: 'Lisbon', region: 'Lisbon, Portugal', lat: 38.7, lon: -9.1, followedAt: '2025-11-01' },
  { id: 'b', name: 'Oslo', region: 'Oslo, Norway', lat: 59.9, lon: 10.7, followedAt: '2026-01-15' },
];

const SEED_RECORDS: DayRecord[] = [
  { id: dayKey('a', '2026-01-01'), cityId: 'a', date: '2026-01-01', hi: 18, lo: 9, mm: 4, source: 'log', snapshots: 2 },
  { id: dayKey('a', '2026-01-02'), cityId: 'a', date: '2026-01-02', hi: 15, lo: 8, source: 'filled', snapshots: 0 },
  { id: dayKey('b', '2026-01-03'), cityId: 'b', date: '2026-01-03', hi: 0, lo: -5, snow: 12, source: 'edited', snapshots: 1 },
];

const SEED_DATES = { a: ['2026-01-01', '2026-01-02'], b: ['2026-01-03'] };

function seed(app: App): void {
  for (const city of SEED_CITIES) { app.cache.upsert('city', city); }
  for (const record of SEED_RECORDS) { app.cache.upsert('dayRecord', record); }
  app.city.useCityStore.setState({ cityIds: ['a', 'b'], onboarded: true });
  app.log.useLogStore.setState({ dates: SEED_DATES });
  app.settings.useSettingsStore.getState().updateSettings({
    offline: true, tempUnit: 'F', windUnit: 'mph', snapshotMinutes: 15, backfill: true, accent: 'custom', accentColor: '#16a34a', apiKey: 'secret-key',
  });
}

function exportText(app: App): string {
  const { cities, history, settings } = app.sync.exportSnapshot();
  const { apiKey: _omit, ...safeSettings } = settings;
  return JSON.stringify({ version: app.backup.BACKUP_VERSION, exportedAt: new Date().toISOString(), settings: safeSettings, cities, history }, null, 2);
}

function importedSettings(app: App): ReturnType<App['settings']['useSettingsStore']['getState']>['settings'] {
  return app.settings.useSettingsStore.getState().settings;
}

describe('backup round trip', () => {
  it('round-trips the full app state through export and import', async () => {
    const app = await fresh();
    seed(app);
    const text = exportText(app);
    const target = await fresh();
    target.settings.useSettingsStore.setState({ settings: { ...defaultSettings } });
    const backup = app.backup.parseBackup(text);
    expect(backup.skipped).toEqual([]);
    await target.sync.importBackup(backup, { cities: true, history: true, settings: true });
    expect(target.city.useCityStore.getState().cityIds).toEqual(['a', 'b']);
    for (const city of SEED_CITIES) { expect(target.cache.getOne('city', city.id)).toEqual(city); }
    expect(target.log.useLogStore.getState().dates).toEqual(SEED_DATES);
    for (const record of SEED_RECORDS) { expect(target.cache.getOne('dayRecord', record.id)).toEqual(record); }
    const settings = importedSettings(target);
    expect(settings.tempUnit).toBe('F');
    expect(settings.windUnit).toBe('mph');
    expect(settings.snapshotMinutes).toBe(15);
    expect(settings.backfill).toBe(true);
    expect(settings.accent).toBe('custom');
    expect(settings.accentColor).toBe('#16a34a');
    expect(settings.offline).toBe(true);
    expect(settings.apiKey).toBe('');
  });

  it('imports only the selected parts and leaves the rest at defaults', async () => {
    const app = await fresh();
    seed(app);
    const text = exportText(app);
    const target = await fresh();
    target.settings.useSettingsStore.setState({ settings: { ...defaultSettings } });
    const backup = app.backup.parseBackup(text);
    await target.sync.importBackup(backup, { cities: true, history: true, settings: false });
    expect(target.city.useCityStore.getState().cityIds).toEqual(['a', 'b']);
    expect(target.log.useLogStore.getState().dates).toEqual(SEED_DATES);
    for (const record of SEED_RECORDS) { expect(target.cache.getOne('dayRecord', record.id)).toEqual(record); }
    expect(importedSettings(target)).toEqual(defaultSettings);
  });
});
