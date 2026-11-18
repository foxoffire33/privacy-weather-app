import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../settingsSchema';

import type * as Idb from '../core/idb';
import type * as Store from '../settingsStore';

interface Fresh {
  store: typeof Store;
  idb: typeof Idb;
}

async function fresh(): Promise<Fresh> {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  return { store: await import('../settingsStore'), idb: await import('../core/idb') };
}

describe('settings store hydration', () => {
  it('recovers corrupt persisted settings and records the issues', async () => {
    const { store, idb } = await fresh();
    await idb.idbSet('wl2-settings', { version: 1, state: { settings: { tempUnit: 'X', snapshotMinutes: 30 } } });
    await store.useSettingsStore.persist.rehydrate();
    expect(store.settingsValidationIssues()).toEqual(['tempUnit: Invalid option: expected one of "C"|"F"']);
    expect(store.useSettingsStore.getState().settings).toEqual({ ...defaultSettings, snapshotMinutes: 30 });
  });

  it('keeps valid persisted settings and records no issues', async () => {
    const { store, idb } = await fresh();
    const settings = { ...defaultSettings, tempUnit: 'F', snapshotMinutes: 15 };
    await idb.idbSet('wl2-settings', { version: 1, state: { settings } });
    await store.useSettingsStore.persist.rehydrate();
    expect(store.settingsValidationIssues()).toEqual([]);
    expect(store.useSettingsStore.getState().settings).toEqual(settings);
  });

  it('starts with defaults and no issues when storage is empty', async () => {
    const { store } = await fresh();
    await store.useSettingsStore.persist.rehydrate();
    expect(store.settingsValidationIssues()).toEqual([]);
    expect(store.useSettingsStore.getState().settings).toEqual(defaultSettings);
  });

  it('keeps user edits when rehydration completes late', async () => {
    const { store, idb } = await fresh();
    await idb.idbSet('wl2-settings', { version: 1, state: { settings: { ...defaultSettings, tempUnit: 'F', snapshotMinutes: 30 } } });
    const pending = store.useSettingsStore.persist.rehydrate();
    store.useSettingsStore.getState().updateSettings({ snapshotMinutes: 15 });
    await pending;
    expect(store.useSettingsStore.getState().settings.snapshotMinutes).toBe(15);
    expect(store.useSettingsStore.getState().settings.tempUnit).toBe('F');
    const persist = await import('../core/persistStorage');
    await persist.flushPersistedState('wl2-settings');
    expect(await idb.idbGet('wl2-settings')).toMatchObject({ state: { settings: { tempUnit: 'F', snapshotMinutes: 15 } } });
    expect(store.settingsValidationIssues()).toEqual([]);
  });
});
