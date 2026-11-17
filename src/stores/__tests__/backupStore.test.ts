import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { MAX_BACKUP_BYTES } from '../../backup/backup';
import { dayKey } from '../entities/schema';

import type * as Backup from '../backupStore';
import type * as CityStore from '../cityStore';
import type * as Cache from '../entities/cache';
import type * as Log from '../logStore';
import type * as SettingsStore from '../settingsStore';
import type { City, DayRecord } from '../types';

interface Modules {
  backup: typeof Backup;
  city: typeof CityStore;
  cache: typeof Cache.entityCache;
  log: typeof Log;
  settings: typeof SettingsStore;
}

async function fresh(): Promise<Modules> {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  const [backup, city, cacheModule, log, settings] = await Promise.all([
    import('../backupStore'),
    import('../cityStore'),
    import('../entities/cache'),
    import('../logStore'),
    import('../settingsStore'),
  ]);
  return { backup, city, cache: cacheModule.entityCache, log, settings };
}

const cityRec = (id: string, lat = 38.7): City => ({ id, name: `City ${id}`, region: '', lat, lon: -9.1, followedAt: '2026-01-01' });

const backupFile = (payload: Record<string, unknown>): File =>
  new File([JSON.stringify({ version: 1, exportedAt: '2026-01-01T00:00:00.000Z', ...payload })], 'weather-log.json');

function seedCity(city: typeof CityStore, cache: typeof Cache.entityCache, id: string): void {
  cache.upsert('city', cityRec(id));
  city.useCityStore.setState({ cityIds: [id], onboarded: true });
}

describe('backup import version gate', () => {
  it('rejects a future-version backup without mutating live state', async () => {
    const { backup, city } = await fresh();
    const before = city.useCityStore.getState();
    const file = new File([JSON.stringify({ version: 99, cities: [{ id: '1', name: 'X', region: '', lat: 1, lon: 1, followedAt: '2026-01-01' }] })], 'weather-log.json');
    await backup.useBackupStore.getState().pick(file);
    const state = backup.useBackupStore.getState();
    expect(state.pending).toBeNull();
    expect(state.result).toMatchObject({ ok: false });
    expect(city.useCityStore.getState()).toEqual(before);
  });

  it('holds a valid backup in pending without committing it', async () => {
    const { backup, city } = await fresh();
    const file = new File([JSON.stringify({ version: 1, cities: [{ id: '1', name: 'Lisbon', region: '', lat: 38.7, lon: -9.1, followedAt: '2026-01-01' }] })], 'weather-log.json');
    await backup.useBackupStore.getState().pick(file);
    const state = backup.useBackupStore.getState();
    expect(state.pending).not.toBeNull();
    expect(state.result).toBeNull();
    expect(city.useCityStore.getState().cityIds).toEqual([]);
  });
});

describe('backup import corrupted input', () => {
  it('rejects a file over the size limit without mutating live state', async () => {
    const { backup, cache, city } = await fresh();
    seedCity(city, cache, 'a');
    const before = city.useCityStore.getState();
    const file = new File(['x'.repeat(MAX_BACKUP_BYTES + 1)], 'weather-log.json');
    await backup.useBackupStore.getState().pick(file);
    const state = backup.useBackupStore.getState();
    expect(state.pending).toBeNull();
    expect(state.result).toMatchObject({ ok: false });
    expect(city.useCityStore.getState()).toEqual(before);
  });

  it('rejects a file that is not JSON without mutating live state', async () => {
    const { backup, cache, city } = await fresh();
    seedCity(city, cache, 'a');
    const before = city.useCityStore.getState();
    const file = new File(['not json at all'], 'weather-log.json');
    await backup.useBackupStore.getState().pick(file);
    const state = backup.useBackupStore.getState();
    expect(state.pending).toBeNull();
    expect(state.result).toMatchObject({ ok: false });
    expect(city.useCityStore.getState()).toEqual(before);
  });
});

describe('backup import commit', () => {
  it('commits a valid import and reports the counts', async () => {
    const { backup, cache, city, log, settings } = await fresh();
    settings.useSettingsStore.getState().updateSettings({ offline: true, tempUnit: 'F' });
    seedCity(city, cache, 'a');
    log.useLogStore.setState({ dates: { a: ['2026-01-05'] } });
    await backup.useBackupStore.getState().pick(backupFile({
      cities: [cityRec('b')],
      history: { b: { '2026-01-01': { hi: 30, lo: 20, source: 'log', snapshots: 0 } } },
      settings: { tempUnit: 'C' },
    }));
    backup.useBackupStore.getState().setPart('settings', true);
    backup.useBackupStore.getState().confirm();
    expect(city.useCityStore.getState().cityIds).toEqual(['a', 'b']);
    expect(log.useLogStore.getState().dates).toEqual({ a: ['2026-01-05'], b: ['2026-01-01'] });
    expect(settings.useSettingsStore.getState().settings.tempUnit).toBe('C');
    expect(backup.useBackupStore.getState().result).toMatchObject({ ok: true, cities: 1, days: 1 });
    expect(backup.useBackupStore.getState().pending).toBeNull();
  });

  it('rolls back every part of a failed commit', async () => {
    const { backup, cache, city, log, settings } = await fresh();
    settings.useSettingsStore.getState().updateSettings({ offline: true, tempUnit: 'F' });
    const original: DayRecord = { id: dayKey('a', '2026-01-05'), cityId: 'a', date: '2026-01-05', hi: 20, lo: 10, source: 'log', snapshots: 0 };
    seedCity(city, cache, 'a');
    cache.upsert('dayRecord', original);
    log.useLogStore.setState({ dates: { a: ['2026-01-05'] } });
    await backup.useBackupStore.getState().pick(backupFile({
      cities: [cityRec('a'), cityRec('b')],
      history: {
        a: { '2026-01-05': { hi: 99, lo: 1, source: 'log', snapshots: 0 }, '2026-01-06': { hi: 50, lo: 1, source: 'log', snapshots: 0 } },
        b: { '2026-01-01': { hi: 30, lo: 1, source: 'log', snapshots: 0 } },
      },
      settings: { tempUnit: 'C' },
    }));
    settings.useSettingsStore.setState({ updateSettings: () => { throw new Error('boom'); } });
    backup.useBackupStore.getState().setPart('settings', true);
    backup.useBackupStore.getState().confirm();
    expect(backup.useBackupStore.getState().result).toMatchObject({ ok: false });
    expect(backup.useBackupStore.getState().pending).toBeNull();
    expect(city.useCityStore.getState().cityIds).toEqual(['a']);
    expect(cache.getOne('city', 'b')).toBeUndefined();
    expect(cache.getOne('dayRecord', dayKey('a', '2026-01-05'))).toEqual(original);
    expect(cache.getOne('dayRecord', dayKey('a', '2026-01-06'))).toBeUndefined();
    expect(cache.getOne('dayRecord', dayKey('b', '2026-01-01'))).toBeUndefined();
    expect(log.useLogStore.getState().dates).toEqual({ a: ['2026-01-05'] });
    expect(settings.useSettingsStore.getState().settings.tempUnit).toBe('F');
  });

  it('never imports records that parsing skipped', async () => {
    const { backup, cache, city, log, settings } = await fresh();
    settings.useSettingsStore.getState().updateSettings({ offline: true });
    await backup.useBackupStore.getState().pick(backupFile({
      cities: [cityRec('1'), cityRec('2', 999)],
      history: { '2': { '2026-01-01': { hi: 30, lo: 1, source: 'log', snapshots: 0 } } },
      settings: { tempUnit: 'C' },
    }));
    expect(backup.useBackupStore.getState().pending?.skipped).toEqual([
      { path: 'cities[1]', reason: 'invalid coordinates' },
      { path: 'history.2', reason: 'history for an unknown city' },
    ]);
    backup.useBackupStore.getState().confirm();
    expect(city.useCityStore.getState().cityIds).toEqual(['1']);
    expect(cache.getOne('city', '2')).toBeUndefined();
    expect(log.useLogStore.getState().dates).toEqual({});
    expect(backup.useBackupStore.getState().result).toMatchObject({ ok: true, cities: 1, days: 0 });
  });
});
