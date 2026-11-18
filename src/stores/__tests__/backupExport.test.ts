import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { BACKUP_VERSION, MAX_BACKUP_BYTES, MAX_DAYS_PER_CITY, exportBackupFiles, parseBackup } from '../../backup/backup';
import { inSequence } from '../core/guards';
import { defaultSettings } from '../settingsSchema';

import type * as Format from '../../utils/format';
import type { City, DayRecord } from '../types';

vi.mock('../../utils/format', async (importOriginal) => {
  const actual = await importOriginal<typeof Format>();
  return { ...actual, downloadFile: vi.fn() };
});

const city = (id: string): City => ({ id, name: `City ${id}`, region: '', lat: 48, lon: 2, followedAt: '2020-01-01' });
const dateOf = (i: number): string => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
const values = { hi: 19, lo: 7, feelsHi: 18, feelsLo: 5, mm: 1, snow: 0, wind: 20, gust: 32, sunshine: 4000, uv: 3, code: 2, source: 'log' as const, snapshots: 3 };

describe('backup export limits', () => {
  it('splits more than the per-city day limit into complete importable parts', async () => {
    const history = Object.fromEntries(Array.from({ length: MAX_DAYS_PER_CITY + 4 }, (_, i) => [dateOf(i), { ...values, date: dateOf(i) }]));
    const files = exportBackupFiles({ cities: [city('a')], history: { a: history }, settings: { ...defaultSettings, apiKey: 'secret' } });
    expect(files.length).toBeGreaterThan(1);
    const all = new Set<string>();
    for (const file of files) {
      const parsed = parseBackup(file.text);
      expect(parsed.skipped).toEqual([]);
      expect(file.text).not.toContain('secret');
      for (const key of Object.keys(parsed.history.a)) { all.add(key); }
    }
    expect(all.size).toBe(MAX_DAYS_PER_CITY + 4);
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    vi.resetModules();
    const sync = await import('../weatherSync');
    await inSequence(files, async (file) => {
      const parsed = parseBackup(file.text, new Set(sync.followedCities().map((item) => item.id)));
      await sync.importBackup(parsed, { cities: true, history: true, settings: true });
    });
    expect(sync.storedCounts()).toEqual({ cities: 1, days: MAX_DAYS_PER_CITY + 4 });
  });

  it('splits large multi-city exports within the import byte limit', () => {
    const cities = Array.from({ length: 25 }, (_, i) => city(String(i)));
    const days = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [dateOf(i), { ...values, date: dateOf(i) }]));
    const files = exportBackupFiles({ cities, history: Object.fromEntries(cities.map((c) => [c.id, days])), settings: defaultSettings });
    expect(files.length).toBeGreaterThan(1);
    let records = 0;
    for (const file of files) {
      expect(new TextEncoder().encode(file.text).length).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
      const parsed = parseBackup(file.text);
      expect(parsed.version).toBe(BACKUP_VERSION);
      expect(parsed.skipped).toEqual([]);
      records += Object.values(parsed.history).reduce((n, group) => n + Object.keys(group).length, 0);
    }
    expect(records).toBe(50_000);
  });

  it('uses the real export action and omits the API key', async () => {
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    vi.resetModules();
    const [backup, cache, cityStore, log, settings, format] = await Promise.all([
      import('../backupStore'), import('../entities/cache'), import('../cityStore'), import('../logStore'), import('../settingsStore'), import('../../utils/format'),
    ]);
    vi.mocked(format.downloadFile).mockResolvedValue();
    cache.entityCache.upsert('city', city('a'));
    const record: DayRecord = { id: 'a:2026-01-01', cityId: 'a', date: '2026-01-01', ...values };
    cache.entityCache.upsert('dayRecord', record);
    cityStore.useCityStore.setState({ cityIds: ['a'], onboarded: true });
    log.useLogStore.setState({ dates: { a: ['2026-01-01'] } });
    settings.useSettingsStore.getState().updateSettings({ apiKey: 'secret-key' });
    await backup.useBackupStore.getState().exportFile();
    expect(backup.useBackupStore.getState().result).toBeNull();
    expect(format.downloadFile).toHaveBeenCalledTimes(1);
    const [name, text] = vi.mocked(format.downloadFile).mock.calls[0];
    expect(name).toBe('weather-log.json');
    expect(text).not.toContain('secret-key');
    const parsed = parseBackup(text);
    expect(parsed.cities).toEqual([city('a')]);
    expect(parsed.history.a['2026-01-01']).toMatchObject({ hi: 19, lo: 7 });
  });
});
