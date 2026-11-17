import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import type * as Backup from '../backupStore';
import type * as City from '../cityStore';

async function fresh(): Promise<{ backup: typeof Backup; city: typeof City }> {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  return { backup: await import('../backupStore'), city: await import('../cityStore') };
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
