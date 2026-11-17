import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Idb from '../core/idb';

vi.mock('../core/idb', async (importOriginal) => {
  const actual = await importOriginal<typeof Idb>();
  return { ...actual, idbSet: vi.fn(), recordsWrite: vi.fn() };
});

const QUOTA = () => new DOMException('QuotaExceededError', 'QuotaExceededError');

const okWrite = async (): Promise<void> => {
  await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('storage faults are diagnosable and observable', () => {
  it('reports a failed record flush as a diagnostic entry, a metric, and a boot fault', async () => {
    vi.resetModules();
    await import('..');
    const [idb, rsync, diag, boot] = await Promise.all([
      import('../core/idb'),
      import('../core/recordSync'),
      import('../diagnosticsStore'),
      import('../bootStore'),
    ]);
    diag.useDiagnosticsStore.getState().clear();
    vi.mocked(idb.recordsWrite).mockImplementation(async () => {
      await Promise.resolve();
      throw QUOTA();
    });
    rsync.putRecord('p:x', 1);
    await expect(rsync.flushRecords()).rejects.toMatchObject({ code: 'quota-exceeded' });
    expect(diag.useDiagnosticsStore.getState().entries).toHaveLength(1);
    const [entry] = diag.useDiagnosticsStore.getState().entries;
    expect(entry.kind).toBe('failure');
    expect(entry.name).toBe('record-flush');
    expect(entry.detail).toBe('quota-exceeded');
    expect(diag.useDiagnosticsStore.getState().metrics.recordFlushFailures).toBe(1);
    expect(boot.useBootStore.getState().storageError).toMatchObject({ code: 'storage.quota-exceeded' });
    expect(rsync.recordSyncStatus().pending).toBe(1);
  });

  it('counts a successful record flush without a failure entry', async () => {
    vi.resetModules();
    const [, idb, rsync, diag] = await Promise.all([
      import('..'),
      import('../core/idb'),
      import('../core/recordSync'),
      import('../diagnosticsStore'),
    ]);
    diag.useDiagnosticsStore.getState().clear();
    vi.mocked(idb.recordsWrite).mockImplementation(okWrite);
    rsync.putRecord('p:x', 1);
    await rsync.flushRecords();
    expect(diag.useDiagnosticsStore.getState().metrics.recordFlushes).toBe(1);
    expect(diag.useDiagnosticsStore.getState().entries).toEqual([]);
  });

  it('reports a failed settings write as a diagnostic entry and a metric', async () => {
    vi.resetModules();
    const [barrel, idb, diag, settings] = await Promise.all([
      import('..'),
      import('../core/idb'),
      import('../diagnosticsStore'),
      import('../settingsStore'),
    ]);
    diag.useDiagnosticsStore.getState().clear();
    vi.useFakeTimers();
    vi.mocked(idb.idbSet).mockImplementation(async () => {
      await Promise.resolve();
      throw QUOTA();
    });
    settings.useSettingsStore.getState().updateSettings({ snapshotMinutes: 15 });
    await expect(barrel.flushPersistedState('wl2-settings')).rejects.toMatchObject({ code: 'quota-exceeded' });
    expect(diag.useDiagnosticsStore.getState().entries).toHaveLength(1);
    const [entry] = diag.useDiagnosticsStore.getState().entries;
    expect(entry.kind).toBe('failure');
    expect(entry.name).toBe('kv-flush');
    expect(entry.detail).toBe('quota-exceeded');
    expect(diag.useDiagnosticsStore.getState().metrics.kvFlushFailures).toBe(1);
    vi.mocked(idb.idbSet).mockImplementation(okWrite);
    await vi.advanceTimersByTimeAsync(300);
  });
});
